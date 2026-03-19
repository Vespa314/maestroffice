import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db_connection, MASTER_STAFF

router = APIRouter(prefix="/admin", tags=["管理密码"])


class PasswordVerifyRequest(BaseModel):
    password: str


class PasswordSetRequest(BaseModel):
    password: str


def hash_password(password: str) -> str:
    """使用 SHA256 哈希密码"""
    return hashlib.sha256(password.encode()).hexdigest()


def get_password_hash():
    """从数据库获取存储的密码哈希"""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT password_hash FROM admin_passwords ORDER BY id DESC LIMIT 1").fetchone()
        if row:
            return row["password_hash"]
        return None
    finally:
        conn.close()


def set_password_hash(password_hash: str):
    """保存密码哈希到数据库"""
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO admin_passwords (password_hash) VALUES (?)", (password_hash,))
        conn.commit()
    finally:
        conn.close()


@router.post("/verify-password")
async def verify_password(request: PasswordVerifyRequest):
    """验证管理密码"""
    password_hash = get_password_hash()

    if password_hash is None:
        raise HTTPException(status_code=404, detail="未配置密码")

    # 验证密码
    if hash_password(request.password) == password_hash:
        return {"valid": True}
    else:
        return {"valid": False}


@router.post("/set-password")
async def set_password(request: PasswordSetRequest):
    """设置管理密码"""
    password_hash = get_password_hash()

    # 如果已经存在密码，不允许覆盖
    if password_hash is not None:
        raise HTTPException(status_code=403, detail="密码已存在，不允许重复设置")

    if len(request.password) < 4:
        raise HTTPException(status_code=400, detail="密码长度至少为4位")

    # 保存新的密码哈希
    set_password_hash(hash_password(request.password))

    return {"message": "密码设置成功"}


@router.get("/password-status")
async def get_password_status():
    """获取密码状态"""
    password_hash = get_password_hash()

    return {
        "has_password": password_hash is not None
    }


@router.get("/master-staff")
async def get_master_staff():
    """获取 MASTER_STAFF/管理员配置"""
    return {
        "master_staff": MASTER_STAFF
    }
