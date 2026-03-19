#!/bin/bash

# 生产环境停止脚本

echo "🛑 Stopping production environment..."

# 停止后端服务 (端口 18520)
PORT=18520
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "🔴 Stopping backend server on port $PORT..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ Backend server stopped"
else
    echo "ℹ️  No backend server running on port $PORT"
fi

# 停止主循环进程 (main.py)
if pgrep -f "python3 main.py" > /dev/null; then
    echo "🔴 Stopping main loop process..."
    pkill -9 -f "python3 main.py" 2>/dev/null || true
    sleep 1
    echo "✅ Main loop process stopped"
else
    echo "ℹ️  No main loop process running"
fi

echo "✨ Production environment stopped!"
