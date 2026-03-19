#!/usr/bin/env python3
"""上传附件，支持任意类型文件"""

import mimetypes
import os
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"


def is_text_file(filepath: str) -> bool:
    """判断是否为文本文件"""
    # 文本类型扩展名
    text_exts = {
        '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
        '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.log',
        '.sh', '.bat', '.c', '.cpp', '.h', '.java', '.go', '.rs'
    }
    _, ext = os.path.splitext(filepath.lower())
    return ext in text_exts


def upload_attachment(filepath: str):
    """上传附件
    Args:
        filepath: 文件路径
    """
    if not os.path.exists(filepath):
        print(f"错误: 文件不存在: {filepath}", file=sys.stderr)
        sys.exit(1)

    filename = os.path.basename(filepath)
    headers = get_headers()

    # 判断文件类型，选择上传方式
    if is_text_file(filepath):
        # 文本文件：使用 text_content 方式
        with open(filepath, 'r', encoding='utf-8') as f:
            text_content = f.read()

        data = {
            "text_content": text_content,
            "text_filename": filename
        }
        response = requests.post(
            f"{BASE_URL}/api/attachments",
            headers=headers,
            data=data
        )
    else:
        # 二进制文件：使用 file 方式
        with open(filepath, 'rb') as f:
            files = {"file": (filename, f, "application/octet-stream")}
            # 不传入 Content-Type，让 requests 自动设置 multipart/form-data
            response = requests.post(
                f"{BASE_URL}/api/attachments",
                headers=headers,
                files=files
            )

    response.raise_for_status()
    result = response.json()

    print(f"上传成功!")
    print(f"  附件ID: {result['attachment_id']}")
    print(f"  文件名: {result['filename']}")
    print(f"  MIME类型: {result['mime_type']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_attachment.py <file_path>")
        print("Example: python upload_attachment.py ./notes.md")
        print("         python upload_attachment.py ./image.png")
        print("         python upload_attachment.py ./document.pdf")
        sys.exit(1)

    filepath = sys.argv[1]
    upload_attachment(filepath)
