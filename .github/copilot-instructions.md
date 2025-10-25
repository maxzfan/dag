# AI Agent Instructions for Voice AI Conversation Project

## Project Overview
This is a real-time voice conversation application that integrates multiple AI services:
- Frontend browser app for voice recording and playback (`js/app.js`)
- Flask backend server (`voice_server.py`) orchestrating:
  - Fish Audio for text-to-speech
  - OpenAI Whisper for speech-to-text
  - OpenRouter/OpenAI for conversation

## Key Architecture Patterns

### Frontend Voice Processing
- Audio recording uses `MediaRecorder` API with specific configuration:
  - Sample rate: 44100Hz
  - Features: echoCancellation and noiseSuppression enabled
  - MIME type fallback sequence: webm/opus → webm → mp4 → wav
- See `js/app.js` for recording implementation pattern

### Backend Service Integration
- Flask server handles CORS for development origins (localhost:8080, localhost:3000)
- Temporary file pattern: Uses `/tmp` directory with UUID-based naming
- API endpoints follow RESTful patterns:
  - POST /speech-to-text - Audio transcription
  - POST /text-to-speech - Audio synthesis 
  - POST /conversation - AI chat responses
  - POST /reset-conversation - Clear history
  - GET /health - Service health check

### Environment & Configuration
- Required API keys in `.env`:
  - FISH_AUDIO_API_KEY
  - OPENAI_API_KEY 
  - OPENROUTER_API_KEY (for chat completions)

## Development Workflow

### Local Setup
1. Python environment: `pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and add API keys
3. Start backend: `python voice_server.py` (runs on port 5000)
4. Start frontend: `npm start` (runs on port 8080)

### Testing Guidelines
- Always test microphone permissions in browser first
- Verify audio file size in backend logs for upload issues
- Check CORS settings if getting API connection errors

## Common Patterns & Conventions
- Error handling: All API endpoints return JSON with `error` field
- Logging: Uses Python's `logging` module with INFO level
- Audio formats: Handles both .webm and .wav input formats
- Conversation state: Maintained in memory on backend

## Integration Points
- Frontend → Backend: FormData for audio uploads
- Backend → Fish Audio: SDK for TTS, REST API for STT
- Backend → OpenRouter: REST API for chat completions
- Frontend ↔ User: MediaRecorder API and Audio element