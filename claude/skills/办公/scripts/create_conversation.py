#!/usr/bin/env python3
"""创建对话"""

import json
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"

def create_conversation(title, members):
    data = {
        "title": title,
        "members": members
    }
    response = requests.post(f"{BASE_URL}/api/conversations", json=data, headers=get_headers())
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_conversation.py <title> <member1> <member2> ...")
        print("Example: python create_conversation.py \"项目讨论\" alice bob charlie")
        sys.exit(1)

    title = sys.argv[1]
    members = sys.argv[2:]
    create_conversation(title, members)
