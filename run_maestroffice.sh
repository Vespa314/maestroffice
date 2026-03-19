#!/bin/bash

./build.sh

nohup ./start-prod.sh > prod.log 2>&1 &
sleep 5
# -u 或 PYTHONUNBUFFERED=1 让 print 实时写入 trigger.log（否则重定向到文件时 Python 会全缓冲）
PYTHONUNBUFFERED=1 nohup python3 ai_company_trigger.py > trigger.log 2>&1 &

echo "Maestroffice服务已启动！"
echo "请访问：http://localhost:18520"
