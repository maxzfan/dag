#!/usr/bin/env python3
import os
import tempfile
import uuid
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fish_audio_sdk import Session, TTSRequest
import requests
from dotenv import load_dotenv
import logging
#from sysprompt import SYSTEM_PROMPT
from pathlib import Path
SYSTEM_PROMPT = Path(__file__).with_name("systemprompt3.md").read_text(encoding="utf-8")


# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JSONL storage setup
DATA_DIR = Path(__file__).with_name("data")
try:
    DATA_DIR.mkdir(exist_ok=True)
    logger.info(f"Journal data directory: {DATA_DIR}")
except Exception as e:
    logger.error(f"Failed to create data directory {DATA_DIR}: {e}")

def _journal_file_for(date: datetime) -> Path:
    return DATA_DIR / f"journal-{date.date().isoformat()}.jsonl"

def save_conversation_entry(conversation_id: str, user_text: str, ai_summary: str, extra: dict | None = None) -> dict:
    """Save or update a conversation entry with grouped messages.
    
    If conversation_id exists, append to it. Otherwise, create new conversation.
    """
    now = datetime.now(timezone.utc)
    
    # Try to find existing conversation
    conversation_file = DATA_DIR / f"conversation-{conversation_id}.json"
    
    if conversation_file.exists():
        # Load existing conversation
        try:
            with conversation_file.open("r", encoding="utf-8") as f:
                conversation_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # If file is corrupted, start fresh
            conversation_data = {
                "id": conversation_id,
                "title": f"Chat {now.date().isoformat()}",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "messages": []
            }
    else:
        # Create new conversation
        conversation_data = {
            "id": conversation_id,
            "title": f"Chat {now.date().isoformat()}",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "messages": []
        }
    
    # Add new message pair
    message_id = str(uuid.uuid4())
    conversation_data["messages"].append({
        "id": message_id,
        "timestamp": now.isoformat(),
        "user_text": user_text,
        "ai_summary": ai_summary,
        "model": extra.get("model", "anthropic/claude-3-haiku") if extra else "anthropic/claude-3-haiku"
    })
    
    # Generate summary if this is the first message or if we have enough content
    if len(conversation_data["messages"]) == 1 or len(conversation_data["messages"]) % 3 == 0:
        try:
            # Build conversation text for summary
            conversation_text = ""
            for msg in conversation_data["messages"]:
                conversation_text += f"User: {msg.get('user_text', '')}\n"
                conversation_text += f"AI: {msg.get('ai_summary', '')}\n"
            
            if conversation_text.strip():
                # Generate summary using the same logic as the endpoint
                summary_prompt = f"""Based on this conversation, generate a comprehensive summary in 2-4 sentences that captures the key points, main topics discussed, and outcomes. The summary should be informative and provide a good overview of what was discussed.

Conversation:
{conversation_text.strip()}

Summary:"""
                
                headers = {
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": "anthropic/claude-3-haiku",
                    "messages": [
                        {"role": "user", "content": summary_prompt}
                    ],
                    "max_tokens": 150,
                    "temperature": 0.7
                }
                
                summary_response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
                
                if summary_response.status_code == 200:
                    summary = summary_response.json()["choices"][0]["message"]["content"].strip()
                    conversation_data["summary"] = summary.strip('"\'')
                    logger.info(f"Generated summary for conversation {conversation_id}")
                else:
                    logger.warning(f"Failed to generate summary for conversation {conversation_id}")
        except Exception as e:
            logger.warning(f"Error generating summary for conversation {conversation_id}: {e}")
    
    # Update timestamp
    conversation_data["updated_at"] = now.isoformat()
    
    # Save back to file
    try:
        with conversation_file.open("w", encoding="utf-8") as f:
            json.dump(conversation_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Updated conversation {conversation_id} with message {message_id}")
    except Exception as e:
        logger.error(f"Failed to save conversation {conversation_id}: {e}")
    
    return conversation_data

def save_journal_entry(user_text: str, ai_summary: str, extra: dict | None = None) -> dict:
    """Append a journal entry to a JSONL file for today's date.

    Returns the entry dict for confirmation/logging.
    """
    now = datetime.now(timezone.utc)
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": now.isoformat(),
        "user_text": user_text,
        "ai_summary": ai_summary,
    }
    if extra:
        # merge shallowly, without overwriting required fields
        for k, v in extra.items():
            if k not in entry:
                entry[k] = v
    jf = _journal_file_for(now)
    try:
        with jf.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(entry, ensure_ascii=False))
            f.write("\n")
        logger.info(f"Appended journal entry to {jf}: {entry['id']}")
    except Exception as e:
        logger.error(f"Failed to write journal entry to {jf}: {e}")
    return entry

# Initialize Fish Audio
FISH_API_KEY = os.getenv('FISH_AUDIO_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

# Check for required environment variables
if not FISH_API_KEY:
    logger.error("FISH_AUDIO_API_KEY environment variable is not set!")
    raise ValueError("FISH_AUDIO_API_KEY environment variable is required")

if not OPENROUTER_API_KEY:
    logger.error("OPENROUTER_API_KEY environment variable is not set!")
    raise ValueError("OPENROUTER_API_KEY environment variable is required")

try:
    fish_session = Session(FISH_API_KEY)
    logger.info("Fish Audio session initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Fish Audio session: {str(e)}")
    raise

FISH_STT_URL = "https://api.fish.audio/v1/asr"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Store conversation history
conversation_history = []
current_conversation_id = None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/text-to-speech', methods=['POST', 'OPTIONS'])
def text_to_speech():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    
    temp_path = None
    try:
        data = request.get_json()
        text = data.get('text', '')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Check if API key is available
        if not FISH_API_KEY or FISH_API_KEY == 'your_fish_audio_api_key_here':
            logger.error("FISH_AUDIO_API_KEY is not properly configured")
            return jsonify({"error": "Fish Audio API key not configured. Please set FISH_AUDIO_API_KEY environment variable."}), 500

        # Create temp directory if it doesn't exist
        temp_dir = tempfile.gettempdir()
        os.makedirs(temp_dir, exist_ok=True)

        # Generate unique filename
        audio_id = str(uuid.uuid4())
        temp_path = os.path.join(temp_dir, f"audio_{audio_id}.mp3")

        # Generate speech using Fish Audio
        logger.info(f"Generating speech for text: {text[:50]}...")
        with open(temp_path, "wb") as f:
            for chunk in fish_session.tts(
                TTSRequest(text=text),
                backend='s1'
            ):
                f.write(chunk)

        logger.info(f"Generated audio file: {temp_path}")
        return send_file(temp_path, mimetype='audio/mpeg')

    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp file after sending
        if temp_path and os.path.exists(temp_path):
            try:
                # Note: We can't remove the file immediately as it's being sent
                # The file will be cleaned up by the OS eventually
                pass
            except Exception as e:
                logger.error(f"Error with temp file cleanup: {e}")

@app.route('/speech-to-text', methods=['POST', 'OPTIONS'])
def speech_to_text():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    
    temp_path = None
    try:
        if 'audio' not in request.files:
            logger.error("No audio file provided in request")
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        logger.info(f"Received audio file: {audio_file.filename}, content_type: {audio_file.content_type}")

        # Create temp directory if it doesn't exist
        temp_dir = tempfile.gettempdir()
        os.makedirs(temp_dir, exist_ok=True)

        # Save uploaded audio temporarily with proper extension
        file_extension = '.webm' if 'webm' in str(audio_file.content_type) else '.wav'
        temp_path = os.path.join(temp_dir, f"upload_{uuid.uuid4()}{file_extension}")
        audio_file.save(temp_path)
        
        logger.info(f"Audio file saved with extension: {file_extension}")
        logger.info(f"Audio file size: {os.path.getsize(temp_path)} bytes")
        logger.info(f"Saved audio to: {temp_path}")

        # Check if API key is available
        if not FISH_API_KEY or FISH_API_KEY == 'your_fish_audio_api_key_here':
            logger.error("FISH_AUDIO_API_KEY is not properly configured")
            return jsonify({"error": "Fish Audio API key not configured. Please set FISH_AUDIO_API_KEY environment variable."}), 500

        # Use Fish Audio for speech-to-text
        headers = {
            "Authorization": f"Bearer {FISH_API_KEY}"
        }

        # Use Fish Audio API for speech-to-text
        with open(temp_path, 'rb') as f:
            files = {
                'audio': (audio_file.filename, f, audio_file.content_type)
            }
            data = {
                'language': 'en',
                'ignore_timestamps': 'true'
            }
            
            logger.info(f"Sending request to Fish Audio API: {FISH_STT_URL}")
            stt_response = requests.post(FISH_STT_URL, headers=headers, files=files, data=data)
            logger.info(f"Fish Audio API response status: {stt_response.status_code}")
            logger.info(f"Fish Audio API response: {stt_response.text}")
            
            if stt_response.status_code != 200:
                logger.error(f"Fish Audio API error: {stt_response.status_code} - {stt_response.text}")
                return jsonify({"error": f"Fish Audio API error: {stt_response.status_code} - {stt_response.text}"}), 500
            
            stt_response.raise_for_status()
            response_data = stt_response.json()
            text = response_data.get('text', '')
            logger.info(f"Transcribed: {text}")

        return jsonify({"text": text})

    except requests.exceptions.RequestException as e:
        logger.error(f"Fish Audio API error: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Fish Audio API response: {e.response.text}")
        return jsonify({"error": f"Fish Audio API error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error in speech-to-text: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"Cleaned up temp file: {temp_path}")
            except Exception as e:
                logger.error(f"Error cleaning up temp file: {e}")

@app.route('/conversation', methods=['POST', 'OPTIONS'])
def conversation():
    global conversation_history, current_conversation_id
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    try:
        data = request.get_json()
        user_text = data.get('text', '')

        if not user_text:
            return jsonify({"error": "No text provided"}), 400

        # Create new conversation ID if none exists or if this is the first message in a conversation
        if not current_conversation_id or len(conversation_history) == 0:
            current_conversation_id = str(uuid.uuid4())
            logger.info(f"Created new conversation ID: {current_conversation_id}")
        else:
            logger.info(f"Continuing existing conversation ID: {current_conversation_id} with {len(conversation_history)} previous messages")

        # Add user message to conversation history
        conversation_history.append({"role": "user", "content": user_text})
        
        # Safety check: ensure conversation history is clean
        conversation_history = [msg for msg in conversation_history if isinstance(msg, dict) and "role" in msg and "content" in msg]

        # Get AI response using OpenRouter with Claude
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "anthropic/claude-3-haiku",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                *conversation_history
            ],
            "max_tokens": 500
        }

        logger.info(f"OpenRouter payload: {payload}")
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        logger.info(f"OpenRouter response status: {response.status_code}")
        logger.info(f"OpenRouter response: {response.text}")
        
        if response.status_code != 200:
            logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
            return jsonify({"error": f"OpenRouter API error: {response.status_code} - {response.text}"}), 500
        
        response.raise_for_status()
        ai_response = response.json()["choices"][0]["message"]["content"]
    

        # Add AI response to conversation history
        conversation_history.append({"role": "assistant", "content": ai_response})

        # Keep conversation history manageable (last 6 messages)
        if len(conversation_history) > 6:
            conversation_history.pop(0)

        logger.info(f"AI Response: {ai_response}")

        # Save to grouped conversation storage
        try:
            save_conversation_entry(
                conversation_id=current_conversation_id,
                user_text=user_text,
                ai_summary=ai_response,
                extra={"model": "anthropic/claude-3-haiku"}
            )
        except Exception as e:
            logger.error(f"Error saving conversation entry: {e}")
        return jsonify({"response": ai_response})

    except Exception as e:
        logger.error(f"Error in conversation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/reset-conversation', methods=['POST'])
def reset_conversation():
    global conversation_history, current_conversation_id
    conversation_history = []
    current_conversation_id = None
    return jsonify({"status": "conversation reset"})

@app.route('/start-new-conversation', methods=['POST'])
def start_new_conversation():
    """Explicitly start a new conversation with a new ID"""
    global conversation_history, current_conversation_id
    conversation_history = []
    current_conversation_id = str(uuid.uuid4())
    logger.info(f"Started new conversation with ID: {current_conversation_id}")
    return jsonify({"status": "new conversation started", "conversation_id": current_conversation_id})

@app.route('/journal-entries', methods=['GET'])
def get_journal_entries():
    """Get all journal entries from conversation JSON files"""
    try:
        entries = []
        
        # Read all conversation JSON files in the data directory
        for conversation_file in DATA_DIR.glob("conversation-*.json"):
            try:
                with conversation_file.open("r", encoding="utf-8") as f:
                    conversation_data = json.load(f)
                    
                    # Convert conversation data to journal entry format
                    messages = []
                    for msg in conversation_data.get("messages", []):
                        messages.extend([
                            {
                                "id": f"user-{msg['id']}",
                                "sender": "user",
                                "text": msg["user_text"],
                                "timestamp": msg["timestamp"]
                            },
                            {
                                "id": f"ai-{msg['id']}",
                                "sender": "ai",
                                "text": msg["ai_summary"],
                                "timestamp": msg["timestamp"]
                            }
                        ])
                    
                    # Generate title if not already present or if it's the default format
                    title = conversation_data.get("title", "")
                    if not title or title.startswith("Journal ") or title.startswith("Chat "):
                        # Generate a dynamic title based on conversation content
                        conversation_text = ""
                        for msg in conversation_data.get("messages", []):
                            conversation_text += f"User: {msg.get('user_text', '')}\n"
                            conversation_text += f"AI: {msg.get('ai_summary', '')}\n"
                        
                        if conversation_text.strip():
                            try:
                                title_prompt = f"""Based on this conversation, generate a short, descriptive title (3-6 words max) that captures the main topic or theme. The title should be concise and meaningful.

Conversation:
{conversation_text.strip()}

Title:"""
                                
                                headers = {
                                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                                    "Content-Type": "application/json"
                                }
                                
                                payload = {
                                    "model": "anthropic/claude-3-haiku",
                                    "messages": [
                                        {"role": "user", "content": title_prompt}
                                    ],
                                    "max_tokens": 20,
                                    "temperature": 0.7
                                }
                                
                                title_response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
                                
                                if title_response.status_code == 200:
                                    generated_title = title_response.json()["choices"][0]["message"]["content"].strip()
                                    title = generated_title.strip('"\'')
                                    if len(title) > 50:
                                        title = title[:47] + "..."
                                    
                                    # Update the conversation file with the new title
                                    conversation_data["title"] = title
                                    with conversation_file.open("w", encoding="utf-8") as f:
                                        json.dump(conversation_data, f, ensure_ascii=False, indent=2)
                                    
                                    logger.info(f"Generated and saved new title for {conversation_data['id']}: {title}")
                                else:
                                    title = f"Chat {conversation_data['created_at'][:10]}"
                            except Exception as e:
                                logger.warning(f"Failed to generate title for {conversation_data['id']}: {e}")
                                title = f"Chat {conversation_data['created_at'][:10]}"
                        else:
                            title = f"Chat {conversation_data['created_at'][:10]}"
                    
                    entry = {
                        "id": conversation_data["id"],
                        "title": title,
                        "timestamp": conversation_data["updated_at"],
                        "messages": messages,
                        "summary": conversation_data.get("summary", "")
                    }
                    entries.append(entry)
                    
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Error reading conversation file {conversation_file}: {e}")
                continue
        
        # Sort by timestamp (newest first)
        entries.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return jsonify({"entries": entries})
        
    except Exception as e:
        logger.error(f"Error reading journal entries: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/journal-entries/<entry_id>', methods=['DELETE'])
def delete_journal_entry(entry_id):
    """Delete a journal entry by removing the corresponding JSON file"""
    try:
        # Find the conversation file for this entry ID
        conversation_file = DATA_DIR / f"conversation-{entry_id}.json"
        
        if not conversation_file.exists():
            logger.warning(f"Conversation file not found: {conversation_file}")
            return jsonify({"error": "Journal entry not found"}), 404
        
        # Delete the file
        conversation_file.unlink()
        logger.info(f"Deleted conversation file: {conversation_file}")
        
        return jsonify({"status": "deleted", "entry_id": entry_id})
        
    except Exception as e:
        logger.error(f"Error deleting journal entry {entry_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate-title', methods=['POST'])
def generate_title():
    """Generate a short title for a conversation based on its content"""
    try:
        data = request.get_json()
        conversation_text = data.get('text', '')
        
        if not conversation_text:
            return jsonify({"error": "No conversation text provided"}), 400
        
        # Create a prompt for title generation
        title_prompt = f"""Based on this conversation, generate a short, descriptive title (3-6 words max) that captures the main topic or theme. The title should be concise and meaningful.

Conversation:
{conversation_text}

Title:"""
        
        # Use OpenRouter to generate the title
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "anthropic/claude-3-haiku",
            "messages": [
                {"role": "user", "content": title_prompt}
            ],
            "max_tokens": 20,
            "temperature": 0.7
        }
        
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            logger.error(f"OpenRouter API error for title generation: {response.status_code} - {response.text}")
            return jsonify({"error": f"Title generation failed: {response.status_code}"}), 500
        
        response.raise_for_status()
        title = response.json()["choices"][0]["message"]["content"].strip()
        
        # Clean up the title (remove quotes, extra whitespace, etc.)
        title = title.strip('"\'')
        if len(title) > 50:  # Truncate if too long
            title = title[:47] + "..."
        
        return jsonify({"title": title})
        
    except Exception as e:
        logger.error(f"Error generating title: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate-summary', methods=['POST'])
def generate_summary():
    """Generate a long-form summary (2-4 sentences) for a conversation"""
    try:
        data = request.get_json()
        conversation_text = data.get('text', '')
        
        if not conversation_text:
            return jsonify({"error": "No conversation text provided"}), 400
        
        # Create a prompt for summary generation
        summary_prompt = f"""Based on this conversation, generate a comprehensive summary in 2-4 sentences that captures the key points, main topics discussed, and outcomes. The summary should be informative and provide a good overview of what was discussed.

Conversation:
{conversation_text}

Summary:"""
        
        # Use OpenRouter to generate the summary
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "anthropic/claude-3-haiku",
            "messages": [
                {"role": "user", "content": summary_prompt}
            ],
            "max_tokens": 150,
            "temperature": 0.7
        }
        
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            logger.error(f"OpenRouter API error for summary generation: {response.status_code} - {response.text}")
            return jsonify({"error": f"Summary generation failed: {response.status_code}"}), 500
        
        response.raise_for_status()
        summary = response.json()["choices"][0]["message"]["content"].strip()
        
        # Clean up the summary (remove quotes, extra whitespace, etc.)
        summary = summary.strip('"\'')
        
        return jsonify({"summary": summary})
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)