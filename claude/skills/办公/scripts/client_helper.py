#!/usr/bin/env python3
"""脚本通用工具"""

import os
from urllib.parse import quote

TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token")


def get_current_user():
    """从token文件读取当前用户"""
    try:
        with open(TOKEN_FILE, 'r', encoding='utf-8') as f:
            username = f.read().strip()
        if not username:
            raise ValueError("Token文件为空")
        return username
    except FileNotFoundError:
        raise FileNotFoundError(f"Token文件不存在，请先创建 {TOKEN_FILE}")
    except Exception as e:
        raise Exception(f"读取token文件失败: {e}")


def get_headers():
    """获取请求headers，包含当前用户信息（URL编码以支持中文）

    token文件格式支持两种：
    1. 仅用户名：username（使用默认公司名）
    2. 完整格式：company_name:username
    """
    user_info = get_current_user()
    # 使用URL编码以支持中文等非ASCII字符
    encoded_auth = quote(user_info, safe='')
    return {"X-Auth": encoded_auth}
