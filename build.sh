#!/bin/bash

# 前端构建脚本

set -e

echo "🔨 Building frontend for production..."

cd frontend

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# 构建前端
echo "🏗️  Building..."
if ! npm run build; then
    echo "❌ Build failed, reinstalling dependencies..."
    npm install
    echo "🏗️  Retrying build..."
    npm run build
fi

echo "✅ Build complete! Output: frontend/dist/"
echo "🚀 Run './start-prod.sh' to start the production server"
