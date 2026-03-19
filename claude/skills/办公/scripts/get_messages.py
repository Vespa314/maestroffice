#!/usr/bin/env python3
"""获取对话消息，优先返回未读消息"""

import json
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"

def get_messages(conversation_id, history_count=0):
    """
    获取对话消息

    Args:
        conversation_id: 对话ID
        history_count: 除了未读消息外，再往前拉取多少条历史消息，0表示只拉取未读消息
    """
    params = {"history_count": history_count}
    response = requests.get(
        f"{BASE_URL}/api/conversations/{conversation_id}/messages",
        params=params,
        headers=get_headers()
    )
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python get_messages.py <conversation_id> [history_count]")
        print("Example: python get_messages.py abc123-def456 10")
        print("         python get_messages.py abc123-def456 0  # 只获取未读消息")
        sys.exit(1)

    conversation_id = sys.argv[1]
    history_count = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    get_messages(conversation_id, history_count)
