#!/bin/bash

echo "🚀 Starting Video Survey Platform (Local Mode)..."

# Kill background processes on exit
trap "kill 0" EXIT

# 0. Cleanup port 8000 (Force stop old backend versions)
echo "🧹 Ensuring port 8000 is free..."
powershell.exe -Command "$conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue; if($conn){ Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }"


# 1. Start Backend
echo "📦 Starting Backend..."
cd backend
if [ ! -d "venv" ]; then
    python -m venv venv
fi
source venv/Scripts/activate || source venv/bin/activate
pip install -r requirements.txt
# Ensure database is migrated
python ../migrate_db.py
uvicorn main:app --host 127.0.0.1 --port 8000 &

BACKEND_PID=$!

# 2. Start Frontend
echo "💻 Starting Frontend..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo "✅ App is running!"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:8000"
echo "Press Ctrl+C to stop both."

wait
