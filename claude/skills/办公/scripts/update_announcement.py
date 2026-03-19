#!/usr/bin/env python3
"""更新对话公告"""

import json
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"

def update_announcement(conversation_id, announcement):
    """更新对话公告

    Args:
        conversation_id: 对话ID
        announcement: 公告内容（设置为空字符串可清除公告）
    """
    data = {
        "announcement": announcement
    }
    response = requests.put(
        f"{BASE_URL}/api/conversations/{conversation_id}",
        json=data,
        headers=get_headers()
    )

    if response.status_code == 200:
        result = response.json()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"错误: {response.status_code}", file=sys.stderr)
        print(json.dumps(response.json(), ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_announcement.py <conversation_id> <announcement_text>", file=sys.stderr)
        print("", file=sys.stderr)
        print("Arguments:", file=sys.stderr)
        print("  conversation_id    对话ID", file=sys.stderr)
        print("  announcement_text  公告内容（设置为空字符串可清除公告）", file=sys.stderr)
        print("", file=sys.stderr)
        print("Examples:", file=sys.stderr)
        print('  python update_announcement.py conv-id "请大家按时提交周报"', file=sys.stderr)
        print('  python update_announcement.py conv-id ""', file=sys.stderr)
        sys.exit(1)

    conversation_id = sys.argv[1]
    announcement = sys.argv[2]

    update_announcement(conversation_id, announcement)
