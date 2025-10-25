#!/usr/bin/env python3
import os
import tempfile
import uuid
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fish_audio_sdk import Session, TTSRequest
import requests
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Fish Audio
fish_session = Session(os.getenv('FISH_AUDIO_API_KEY'))
FISH_API_KEY = os.getenv('FISH_AUDIO_API_KEY')
FISH_STT_URL = "https://api.fish.audio/v1/asr"

# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Store conversation history
conversation_history = []

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/text-to-speech', methods=['POST', 'OPTIONS'])
def text_to_speech():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    try:
        data = request.get_json()
        text = data.get('text', '')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Generate unique filename
        audio_id = str(uuid.uuid4())
        audio_path = f"/tmp/audio_{audio_id}.mp3"

        # Generate speech using Fish Audio
        with open(audio_path, "wb") as f:
            for chunk in fish_session.tts(
                TTSRequest(text=text),
                backend='s1'
            ):
                f.write(chunk)

        logger.info(f"Generated audio for text: {text[:50]}...")
        return send_file(audio_path, mimetype='audio/mpeg')

    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/speech-to-text', methods=['POST', 'OPTIONS'])
def speech_to_text():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        logger.info(f"Received audio file: {audio_file.filename}, content_type: {audio_file.content_type}")

        # Save uploaded audio temporarily with proper extension
        file_extension = '.webm' if 'webm' in str(audio_file.content_type) else '.wav'
        temp_path = f"/tmp/upload_{uuid.uuid4()}{file_extension}"
        audio_file.save(temp_path)
        
        logger.info(f"Audio file saved with extension: {file_extension}")
        logger.info(f"Audio file size: {os.path.getsize(temp_path)} bytes")

        logger.info(f"Saved audio to: {temp_path}")

        # Use Fish Audio for speech-to-text
        headers = {
            "Authorization": f"Bearer {FISH_API_KEY}"
        }

        # Use Fish Audio API for speech-to-text
        with open(temp_path, 'rb') as f:
            files = {
                'audio': f
            }
            data = {
                'language': 'en',
                'ignore_timestamps': 'true'
            }
            
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

        # Clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({"text": text})

    except requests.exceptions.RequestException as e:
        logger.error(f"Fish Audio API error: {str(e)}")
        if hasattr(e.response, 'text'):
            logger.error(f"Fish Audio API response: {e.response.text}")
        # Clean up on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Fish Audio API error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error in speech-to-text: {str(e)}")
        # Clean up on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

@app.route('/conversation', methods=['POST', 'OPTIONS'])
def conversation():
    global conversation_history
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response
    try:
        data = request.get_json()
        user_text = data.get('text', '')

        if not user_text:
            return jsonify({"error": "No text provided"}), 400

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
                {"role": "system", "content": "You are a helpful AI assistant having a voice conversation. Keep responses conversational and concise. Limit your response to 2-3 sentences maximum."},
                *conversation_history
            ],
            "max_tokens": 100
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
        
        # Limit response length for better speech synthesis
        if len(ai_response) > 150:
            ai_response = ai_response[:150] + "..."
            logger.info(f"Truncated response to 150 characters")

        # Add AI response to conversation history
        conversation_history.append({"role": "assistant", "content": ai_response})

        # Keep conversation history manageable (last 6 messages)
        if len(conversation_history) > 6:
            conversation_history.pop(0)

        logger.info(f"AI Response: {ai_response}")
        return jsonify({"response": ai_response})

    except Exception as e:
        logger.error(f"Error in conversation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/reset-conversation', methods=['POST'])
def reset_conversation():
    global conversation_history
    conversation_history = []
    return jsonify({"status": "conversation reset"})

if __name__ == '__main__':
    app.run(debug=True, port=5001)