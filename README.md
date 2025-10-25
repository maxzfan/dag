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
cd backend
pip install -r requirements.txt
```

**Frontend (Node.js)**
```bash
cd frontend
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
cd backend
python3 voice_server.py
```
- Server runs on `http://localhost:5001`

### Start the Frontend Development Server
```bash
cd frontend
npm run dev
```
- Frontend runs on `http://localhost:3000`

### Open in Browser
Navigate to `http://localhost:3000` to access the Nexus interface.

## 📁 Project Structure

```
nexus/
├── backend/                 # Python Flask backend
│   ├── voice_server.py     # Main Flask server
│   ├── sysprompt.py       # System prompt utilities
│   └── requirements.txt   # Python dependencies
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── lib/           # Utility functions
│   │   ├── App.tsx        # Main application
│   │   ├── main.tsx       # React entry point
│   │   └── index.css      # Global styles
│   ├── public/            # Static assets
│   ├── index.html         # HTML entry point
│   ├── package.json       # Node.js dependencies
│   ├── vite.config.ts     # Vite configuration
│   └── tailwind.config.js # Tailwind CSS config
├── assets/                # Static assets
│   ├── icons/            # App icons
│   └── images/           # Images and graphics
├── docs/                 # Documentation
│   ├── SETUP.md         # Detailed setup guide
│   └── README.md        # This file
└── .env                  # Environment variables
```

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

## 🛠️ Development

### Available Scripts

**Frontend Development**
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

**Backend Development**
```bash
cd backend
python3 voice_server.py  # Start Flask server
```

## 📚 Documentation

- **[SETUP.md](docs/SETUP.md)** - Comprehensive setup and configuration guide
- **[README.md](docs/README.md)** - Detailed project documentation

## 🐛 Troubleshooting

### Common Issues

**1. CORS Errors**
- Ensure backend is running on port 5001
- Check that frontend is using the proxy (`/api` endpoints)
- Verify CORS headers in `backend/voice_server.py`

**2. Microphone Not Working**
- Grant microphone permission in browser
- Check if microphone is being used by another application
- Try refreshing the page

**3. API Errors**
- Verify API keys in `.env` file
- Check server logs for detailed error messages
- Ensure internet connection for API calls

## 📄 License

This project is licensed under the MIT License - see the LICENSE.txt file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

**Nexus** - Advanced Voice AI Conversation Platform 🚀
