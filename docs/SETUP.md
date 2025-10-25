# Nexus - Voice AI Conversation Platform

A modern, sleek voice AI conversation application built with React, TypeScript, and shadcn/ui, featuring real-time voice interaction with AI using Fish Audio and OpenRouter APIs.

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Python 3.8+** - [Download here](https://python.org/)
- **Git** - [Download here](https://git-scm.com/)

### API Keys Required
- **Fish Audio API Key** - [Get it here](https://fish.audio/)
- **OpenRouter API Key** - [Get it here](https://openrouter.ai/)

## 📦 Installation

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd nexus
```

### 2. Install Dependencies

**Backend (Python)**
```bash
pip install -r requirements.txt
```

**Frontend (Node.js)**
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```bash
# Fish Audio API Configuration
FISH_AUDIO_API_KEY=your_fish_audio_api_key_here

# OpenRouter API Configuration  
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## 🎯 Running the Application

### Start the Backend Server
```bash
python3 voice_server.py
```
- Server runs on `http://localhost:5001`
- Handles speech-to-text, AI conversation, and text-to-speech

### Start the Frontend Development Server
```bash
npm run dev
```
- Frontend runs on `http://localhost:3000`
- Hot reload enabled for development

### Open in Browser
Navigate to `http://localhost:3000` to access the Nexus interface.

## 🎨 Features

### Modern UI/UX
- **Dark Theme**: Sleek black background with green accents
- **Nexus Branding**: Professional AI platform aesthetic
- **Responsive Design**: Works on desktop and mobile
- **shadcn/ui Components**: Accessible, modern UI components
- **Smooth Animations**: Hover effects, transitions, and visual feedback

### Voice AI Capabilities
- **Real-time Recording**: Browser-based microphone recording
- **Speech-to-Text**: Convert speech to text using Fish Audio
- **AI Conversation**: Chat with Claude AI via OpenRouter
- **Text-to-Speech**: Convert AI responses to speech
- **Conversation History**: Maintains context throughout the session

### Technical Features
- **TypeScript**: Full type safety and better development experience
- **React Hooks**: Modern React patterns for state management
- **Vite**: Fast build tool with hot module replacement
- **Tailwind CSS**: Utility-first styling with custom components
- **CORS Handling**: Proper cross-origin request handling

## 🛠️ Development

### Project Structure
```
nexus/
├── backend/                 # Python backend
│   ├── voice_server.py     # Flask server
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── lib/           # Utility functions
│   │   ├── App.tsx        # Main application
│   │   ├── main.tsx       # React entry point
│   │   └── index.css      # Global styles
│   ├── index.html         # HTML entry point
│   ├── package.json       # Node.js dependencies
│   ├── vite.config.ts     # Vite configuration
│   └── tailwind.config.js # Tailwind CSS config
├── assets/                # Static assets
│   ├── icons/            # App icons
│   └── images/           # Images and graphics
├── docs/                 # Documentation
│   ├── SETUP.md         # This file
│   └── README.md        # Project overview
└── .env                  # Environment variables
```

### Available Scripts

**Development**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

**Backend**
```bash
python3 voice_server.py  # Start Flask server
```

### Building for Production
```bash
# Build the frontend
npm run build

# The built files will be in the dist/ directory
# Serve them with your preferred web server
```

## 🔧 Configuration

### API Endpoints
- `GET /health` - Health check
- `POST /speech-to-text` - Convert audio to text
- `POST /conversation` - Get AI response
- `POST /text-to-speech` - Convert text to audio
- `POST /reset-conversation` - Clear conversation history

### CORS Configuration
The backend is configured to accept requests from:
- `http://localhost:3000` (Vite dev server)
- `http://127.0.0.1:3000` (Alternative localhost)

### Voice Settings
- **Response Length**: Limited to 150 characters for optimal speech synthesis
- **Voice**: Uses Fish Audio default voice
- **Language**: English
- **Sample Rate**: 44.1kHz

## 🐛 Troubleshooting

### Common Issues

**1. CORS Errors**
- Ensure backend is running on port 5001
- Check that frontend is using the proxy (`/api` endpoints)
- Verify CORS headers in `voice_server.py`

**2. Microphone Not Working**
- Grant microphone permission in browser
- Check if microphone is being used by another application
- Try refreshing the page

**3. API Errors**
- Verify API keys in `.env` file
- Check server logs for detailed error messages
- Ensure internet connection for API calls

**4. Build Errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)
- Verify all dependencies are installed

### Debug Mode
- Backend runs in debug mode with detailed logging
- Check terminal output for API request/response details
- Browser console shows frontend debugging information

## 📚 API Documentation

### Fish Audio API
- **Speech-to-Text**: Converts audio files to text
- **Text-to-Speech**: Converts text to audio files
- **Documentation**: [Fish Audio API Docs](https://fish.audio/docs)

### OpenRouter API
- **AI Models**: Access to various AI models including Claude
- **Conversation**: Maintains conversation context
- **Documentation**: [OpenRouter API Docs](https://openrouter.ai/docs)

## 🎨 Customization

### Styling
- Modify `src/index.css` for global styles
- Update `tailwind.config.js` for theme customization
- Customize shadcn/ui components in `src/components/ui/`

### Branding
- Update the "Nexus" branding in `src/App.tsx`
- Modify colors in CSS variables
- Change favicon and app icons in `assets/`

## 📄 License

This project is licensed under the MIT License - see the LICENSE.txt file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review the server logs for error details
3. Ensure all dependencies are properly installed
4. Verify API keys are correct and active

---

**Nexus** - Advanced Voice AI Conversation Platform 🚀
