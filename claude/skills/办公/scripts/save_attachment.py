#!/usr/bin/env python3
"""下载附件文件到本地目录"""

import os
import sys
from urllib.parse import quote

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"


def save_attachment(attachment_id: str, output_dir: str):
    """下载附件到本地目录
    Args:
        attachment_id: 附件ID
        output_dir: 输出目录路径
    """
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 先获取附件信息（获取原始文件名）
    headers = get_headers()
    info_response = requests.get(
        f"{BASE_URL}/api/attachments/{attachment_id}",
        headers=headers
    )
    info_response.raise_for_status()
    info = info_response.json()

    filename = info.get("filename")
    if not filename:
        print(f"错误: 无法获取文件名", file=sys.stderr)
        sys.exit(1)

    # 下载文件
    download_response = requests.get(
        f"{BASE_URL}/api/attachments/{attachment_id}/download",
        headers=headers
    )
    download_response.raise_for_status()

    # 保存文件
    output_path = os.path.join(output_dir, filename)
    with open(output_path, 'wb') as f:
        f.write(download_response.content)

    print(f"已下载: {output_path}")
    print(f"  文件名: {filename}")
    print(f"  大小: {len(download_response.content)} 字节")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python save_attachment.py <attachment_id> <output_dir>")
        print("Example: python save_attachment.py abc123-def456 .")
        print("         python save_attachment.py abc123-def456 ~/Downloads")
        print("Note: 当前用户会自动从token文件中读取")
        sys.exit(1)

    attachment_id = sys.argv[1]
    output_dir = sys.argv[2]
    save_attachment(attachment_id, output_dir)
