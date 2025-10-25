@echo off
echo 🚀 Starting Nexus Voice AI Platform...

echo 📡 Starting backend server...
cd backend
start "Nexus Backend" cmd /k "python3 voice_server.py"
cd ..

timeout /t 3 /nobreak >nul

echo 🎨 Starting frontend server...
cd frontend
start "Nexus Frontend" cmd /k "npm run dev"
cd ..

echo ✅ Nexus is running!
echo 📡 Backend: http://localhost:5001
echo 🎨 Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul
