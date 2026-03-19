#!/usr/bin/env python3
"""获取附件信息（文本附件返回内容）"""

import json
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"

def get_text_attachment(attachment_id):
    """获取附件信息
    - 文本类型：返回 content 字段
    - 非文本类型：返回 download_url
    """
    response = requests.get(f"{BASE_URL}/api/attachments/{attachment_id}", headers=get_headers())
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python get_text_attachment.py <attachment_id>")
        print("Example: python get_text_attachment.py abc123-def456")
        print("Note: 当前用户会自动从token文件中读取")
        sys.exit(1)

    attachment_id = sys.argv[1]
    get_text_attachment(attachment_id)
