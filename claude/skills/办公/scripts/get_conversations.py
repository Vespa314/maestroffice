#!/usr/bin/env python3
"""获取当前用户参与的对话列表"""

import argparse
import json

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"

def get_conversations(unread_only=False, only_member_conversations=True):
    """
    获取对话列表

    Args:
        unread_only: 是否只返回有未读消息的对话
        only_member_conversations: 是否只返回自己是成员的对话
    """
    params = {}
    if unread_only:
        params["unread_only"] = unread_only
    if only_member_conversations:
        params["only_member_conversations"] = only_member_conversations

    params = params if params else None
    response = requests.get(
        f"{BASE_URL}/api/conversations",
        params=params,
        headers=get_headers()
    )
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="获取对话列表")
    parser.add_argument(
        "--unread-only",
        action="store_true",
        help="只返回有未读消息的对话"
    )
    args = parser.parse_args()

    get_conversations(unread_only=args.unread_only)
