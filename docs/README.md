# Voice AI Conversation

A real-time voice conversation application with AI using Fish Audio and OpenRouter APIs.

## Features

- 🎤 **Voice Recording**: Record your voice using the browser microphone
- 🗣️ **Speech-to-Text**: Convert speech to text using Fish Audio API
- 🤖 **AI Conversation**: Chat with Claude AI via OpenRouter
- 🔊 **Text-to-Speech**: Convert AI responses back to speech using Fish Audio
- 💬 **Conversation History**: Maintains context throughout the conversation

## Tech Stack

- **Frontend**: React + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Python Flask
- **APIs**: 
  - Fish Audio (Speech-to-Text & Text-to-Speech)
  - OpenRouter (AI Conversation with Claude)
- **Build Tools**: Vite

## Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- Fish Audio API key
- OpenRouter API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd nexus
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies**
   ```bash
   npm install
   ```

4. **Configure environment variables**
   Create a `.env` file with your API keys:
   ```
   FISH_AUDIO_API_KEY=your_fish_audio_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   python3 voice_server.py
   ```
   Server runs on `http://localhost:5001`

2. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   Frontend runs on `http://localhost:3000`

3. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

1. **Grant microphone permission** when prompted
2. **Click "Start Recording"** and speak clearly
3. **Click "Stop Recording"** when finished
4. **Wait for processing** - the AI will respond with both text and voice
5. **Continue the conversation** by recording again

## API Endpoints

- `GET /health` - Health check
- `POST /speech-to-text` - Convert audio to text
- `POST /conversation` - Get AI response
- `POST /text-to-speech` - Convert text to audio
- `POST /reset-conversation` - Clear conversation history

## Configuration

### Voice Settings
- **Response Length**: Limited to 150 characters for better speech synthesis
- **Voice**: Uses Fish Audio default voice
- **Language**: English

### CORS
- Configured for `http://localhost:3000`
- Supports preflight OPTIONS requests

## Development

### Project Structure
```
nexus/
├── src/
│   ├── components/
│   │   └── ui/            # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts       # Utility functions
│   ├── App.tsx            # Main React component
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles with Tailwind
├── index.html             # HTML entry point
├── voice_server.py        # Flask backend server
├── requirements.txt       # Python dependencies
├── package.json           # Node.js dependencies
├── vite.config.ts         # Vite configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

### Building for Production
```bash
npm run build
```

## Troubleshooting

### Common Issues

1. **"Failed to fetch" error**
   - Check if both servers are running
   - Verify CORS configuration
   - Check browser console for errors

2. **Microphone not working**
   - Grant microphone permission in browser
   - Check if microphone is being used by another application

3. **API errors**
   - Verify API keys in `.env` file
   - Check server logs for detailed error messages

### Debug Mode
- Backend runs in debug mode with detailed logging
- Check terminal output for API request/response details
- Browser console shows frontend debugging information

## License

See LICENSE.txt for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request