# Voice AI Conversation with Fish Audio

A web application that enables voice conversations with AI using Fish Audio for text-to-speech and OpenAI for conversation.

## Features

- 🎤 Voice recording with high-quality audio processing
- 🗣️ Speech-to-text using OpenAI Whisper
- 🤖 AI conversation using GPT-3.5-turbo
- 🔊 Text-to-speech using Fish Audio
- 💬 Real-time conversation display
- 🔄 Conversation reset functionality

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
FISH_AUDIO_API_KEY=your_fish_audio_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start the Backend Server

```bash
python voice_server.py
```

The server will start on `http://localhost:5000`

### 4. Start the Frontend

In a new terminal:

```bash
npm start
```

This will start the webpack dev server and open the application in your browser.

## Usage

1. **Allow microphone access** when prompted by your browser
2. **Click "Start Recording"** to begin recording your voice
3. **Speak your message** clearly
4. **Click "Stop Recording"** when finished
5. **Wait for AI response** - it will appear as text and play as audio
6. **Continue the conversation** by recording more messages
7. **Reset conversation** anytime using the reset button

## API Endpoints

- `POST /speech-to-text` - Convert audio to text
- `POST /conversation` - Get AI response to text
- `POST /text-to-speech` - Convert text to audio
- `POST /reset-conversation` - Reset conversation history
- `GET /health` - Health check

## Browser Requirements

- Modern browser with MediaRecorder API support
- Microphone access permission
- HTTPS (required for microphone access in production)

## Troubleshooting

- **Microphone not working**: Check browser permissions
- **Server errors**: Verify API keys in `.env` file
- **Audio issues**: Try different browsers (Chrome/Firefox recommended)
- **CORS errors**: Ensure both frontend and backend are running

## Architecture

```
Frontend (Browser) ↔ Backend (Python Flask) ↔ External APIs
                                            ├─ Fish Audio (TTS)
                                            ├─ OpenAI Whisper (STT)
                                            └─ OpenAI GPT (Conversation)
```