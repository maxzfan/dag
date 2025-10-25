@echo off
echo 🚀 Starting Nexus Voice AI Platform...

echo 📡 Starting backend server...
start "Nexus Backend" cmd /k "cd backend && python3 voice_server.py"

timeout /t 3 /nobreak >nul

echo 🎨 Starting frontend server...
start "Nexus Frontend" cmd /k "cd frontend && npm run dev"

echo ✅ Nexus is running!
echo 📡 Backend: http://localhost:5001
echo 🎨 Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul
