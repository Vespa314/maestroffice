#!/usr/bin/env python3
"""在对话中发送消息，支持上传本地文件作为附件"""

import json
import os
import sys

import requests
from client_helper import get_headers

BASE_URL = "http://localhost:18520"


def is_text_file(filepath: str) -> bool:
    """判断是否为文本文件"""
    text_exts = {
        '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
        '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.log',
        '.sh', '.bat', '.c', '.cpp', '.h', '.java', '.go', '.rs'
    }
    _, ext = os.path.splitext(filepath.lower())
    return ext in text_exts


def upload_file(filepath: str) -> str:
    """上传文件并返回附件ID
    Args:
        filepath: 文件路径
    Returns:
        附件ID
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
            response = requests.post(
                f"{BASE_URL}/api/attachments",
                headers=headers,
                files=files
            )

    response.raise_for_status()
    result = response.json()

    return result['attachment_id']


def send_message(conversation_id, content=None, attachment_ids=None, file_paths=None):
    """发送消息
    Args:
        conversation_id: 对话ID
        content: 消息内容
        attachment_ids: 已存在的附件ID列表
        file_paths: 本地文件路径列表（会自动上传）
    """
    # 验证消息内容不为空
    if not content or not content.strip():
        print("错误: 消息内容不能为空", file=sys.stderr)
        sys.exit(1)

    # 合并附件ID列表
    all_attachment_ids = (attachment_ids or []).copy()

    # 上传本地文件并获取附件ID
    if file_paths:
        for filepath in file_paths:
            attachment_id = upload_file(filepath)
            all_attachment_ids.append(attachment_id)

    # 发送消息
    data = {
        "content": content,
        "attachment_ids": all_attachment_ids
    }
    response = requests.post(
        f"{BASE_URL}/api/conversations/{conversation_id}/messages",
        json=data,
        headers=get_headers()
    )
    print(f"\n消息发送成功!")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python send_message.py <conversation_id> [options]")
        print("")
        print("Options:")
        print("  --content <text>           消息内容（必需）")
        print("  --attach <id1,id2,...>     附件ID列表，用逗号分隔")
        print("  --files <path1> [path2...] 本地文件路径，用空格分隔（自动上传）")
        print("")
        print("Example:")
        print('  python send_message.py conv-id --content "Hello everyone"')
        print('  python send_message.py conv-id --content "看看这些文件" --attach att1,att2')
        print('  python send_message.py conv-id --content "这是报告" --files ./report.md')
        print('  python send_message.py conv-id --content "图片和附件" --files ./image.png ./doc.pdf --attach att123')
        sys.exit(1)

    conversation_id = sys.argv[1]

    content = None
    attachment_ids = []
    file_paths = []

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--content" and i + 1 < len(sys.argv):
            content = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--attach" and i + 1 < len(sys.argv):
            attachment_ids = sys.argv[i + 1].split(",")
            i += 2
        elif sys.argv[i] == "--files":
            # 收集所有后续的文件路径，直到遇到下一个参数
            i += 1
            while i < len(sys.argv) and not sys.argv[i].startswith("--"):
                file_paths.append(sys.argv[i])
                i += 1
        else:
            i += 1

    send_message(conversation_id, content, attachment_ids, file_paths)
