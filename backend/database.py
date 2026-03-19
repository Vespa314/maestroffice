import os
import sqlite3
import sys

# 使用绝对路径，避免在不同目录启动时创建多个数据库文件
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.path.join(BASE_DIR, "company.db")

# 添加父目录到 sys.path 以导入 util
PARENT_DIR = os.path.dirname(BASE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from util import get_config

# MASTER_STAFF/管理员配置 (公司名:用户名)，该用户可以查看所有对话和消息
# 优先从配置文件读取，如果不存在则使用默认值 "CEO"
MASTER_STAFF: str = str(get_config("master_staff", "CEO"))


def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    # 启用外键约束（必须每次连接都设置，SQLite默认关闭）
    conn.execute("PRAGMA foreign_keys = ON")
    # 设置 SQLite 返回 ISO 格式的时间
    conn.execute("PRAGMA datetime_format = 'iso'")
    return conn


def init_db():
    """初始化数据库表结构"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 公司表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            name TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 用户表 - 改为 (company_name, username) 联合主键
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            company_name TEXT NOT NULL,
            username TEXT NOT NULL,
            is_on_duty BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (company_name, username),
            FOREIGN KEY (company_name) REFERENCES companies(name) ON DELETE CASCADE
        )
    """)

    # 对话表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            title TEXT NOT NULL,
            announcement TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_name) REFERENCES companies(name) ON DELETE CASCADE
        )
    """)

    # 对话成员表 - 改为联合主键并添加company_name
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversation_members (
            conversation_id TEXT,
            company_name TEXT NOT NULL,
            username TEXT NOT NULL,
            PRIMARY KEY (conversation_id, company_name, username),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (company_name, username) REFERENCES users(company_name, username) ON DELETE CASCADE
        )
    """)

    # 消息表 - 添加company_name
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            company_name TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (company_name, sender) REFERENCES users(company_name, username)
        )
    """)

    # 消息附件关联表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS message_attachments (
            message_id TEXT,
            attachment_id TEXT,
            PRIMARY KEY (message_id, attachment_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )
    """)

    # 附件表 - 添加company_name（文件内容存储在attachments目录下）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uploaded_by TEXT,
            FOREIGN KEY (company_name) REFERENCES companies(name) ON DELETE CASCADE,
            FOREIGN KEY (company_name, uploaded_by) REFERENCES users(company_name, username)
        )
    """)

    # 用户对话读取位置表 - 添加company_name
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_conversation_reads (
            company_name TEXT NOT NULL,
            username TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            last_read_message_id TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (company_name, username, conversation_id),
            FOREIGN KEY (company_name, username) REFERENCES users(company_name, username) ON DELETE CASCADE,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    # 管理端密码表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_passwords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Timeline 表 - 记录每个公司每个用户的行为
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_timelines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            output TEXT NOT NULL,
            duration REAL,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            FOREIGN KEY (company_name) REFERENCES companies(name) ON DELETE CASCADE,
            FOREIGN KEY (company_name, username) REFERENCES users(company_name, username) ON DELETE CASCADE
        )
    """)

    # 员工工作状态表 - 记录每个公司每个员工当前是否在工作
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_working_status (
            company_name TEXT NOT NULL,
            username TEXT NOT NULL,
            is_working BOOLEAN DEFAULT 0,
            PRIMARY KEY (company_name, username),
            FOREIGN KEY (company_name, username) REFERENCES users(company_name, username) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


def is_master_staff(company_name: str, username: str) -> bool:
    """检查用户是否是管理员/MASTER_STAFF"""
    return f"{username}" == MASTER_STAFF


def verify_user_in_conversation(conn, conversation_id: str, company_name: str, username: str):
    """验证用户是否在对话中（管理员除外，用于查看场景）"""
    from fastapi import HTTPException

    # 管理员可以查看所有对话
    if is_master_staff(company_name, username):
        return
    member = conn.execute(
        "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username = ?",
        (conversation_id, company_name, username)
    ).fetchone()
    if not member:
        raise HTTPException(status_code=403, detail="您不在此对话中")


def verify_user_in_conversation_strict(conn, conversation_id: str, company_name: str, username: str):
    """严格验证用户是否在对话中（管理员也必须验证，用于发送消息等操作）"""
    from fastapi import HTTPException
    member = conn.execute(
        "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username = ?",
        (conversation_id, company_name, username)
    ).fetchone()
    if not member:
        raise HTTPException(status_code=403, detail="您不在此对话中")
