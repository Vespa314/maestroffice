#!/bin/bash

# 生产环境启动脚本

set -e

echo "🚀 Starting production environment..."

# 检查端口 18520 是否被占用
PORT=18520
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use. Killing existing process..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ Existing process killed"
fi

# 检查是否已构建前端
if [ ! -d "frontend/dist" ]; then
    echo "⚠️  Frontend not built. Building now..."
    echo "📦 Installing dependencies..."
    cd frontend
    npm install
    echo "🔨 Building frontend..."
    npm run build
    cd ..
    echo "✅ Frontend built successfully!"
else
    echo "✅ Frontend already built"
fi

# 检查Python依赖
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "⚠️  Python dependencies not found. Installing..."
    python3 -mpip install -r requirements.txt
fi

# 启动后端
echo "🌟 Starting backend server on port $PORT..."
cd backend
python3 main.py

