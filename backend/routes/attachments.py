import os
import re
import uuid
import mimetypes
import aiofiles
from typing import Optional
from urllib.parse import unquote

from database import get_db_connection
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from models import AttachmentUpload

# 附件存储目录：后端代码的上一级（项目根）下的 attachments 目录
_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
ATTACHMENTS_DIR = os.path.join(os.path.dirname(_BACKEND_DIR), "attachments")


def _safe_filename_part(s: str) -> str:
    """去掉路径与不安全字符，只保留可用于文件名的部分"""
    if not s:
        return ""
    name = os.path.basename(s)
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


def _stored_filename(uploader: str, original_filename: str, attachment_id: str) -> str:
    """生成存储文件名：上传者_文件名_attachment_id.后缀"""
    safe_uploader = _safe_filename_part(uploader)
    base = _safe_filename_part(original_filename)
    name_no_ext, ext = os.path.splitext(base)
    if ext:
        ext = ext.lstrip(".").lower() or ""
    else:
        ext = ""
    safe_name = (name_no_ext or "file").strip() or "file"
    if ext:
        return f"{safe_uploader}_{safe_name}_{attachment_id}.{ext}"
    return f"{safe_uploader}_{safe_name}_{attachment_id}"


def detect_mime_type(filename: str, content: bytes) -> str:
    """检测文件的MIME类型"""
    # 优先使用 mimetypes 库
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type:
        return mime_type

    # 根据文件扩展名手动判断
    _, ext = os.path.splitext(filename.lower())

    # 文本类型扩展名
    text_exts = {'.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
                 '.py', '.js', '.ts', '.html', '.css', '.log', '.sh', '.bat'}
    if ext in text_exts or ext in {'.c', '.cpp', '.h', '.java', '.go', '.rs', '.tsx', '.jsx'}:
        return 'text/plain'

    # 尝试通过内容检测（如果是UTF-8文本）
    try:
        content[:1000].decode('utf-8')
        return 'text/plain'
    except UnicodeDecodeError:
        pass

    # 默认二进制
    return 'application/octet-stream'


def is_text_mime(mime_type: str) -> bool:
    """判断是否为文本类型（可预览）"""
    return mime_type.startswith('text/')


router = APIRouter(prefix="/attachments", tags=["附件"])


async def get_current_auth(x_auth: str = Header(None)) -> tuple:
    """从header获取当前认证信息 (company_name, username)"""
    if not x_auth:
        raise HTTPException(status_code=401, detail="缺少认证信息")
    # 解码URL编码的认证信息（支持中文等非ASCII字符）
    auth = unquote(x_auth)
    # 格式: company_name:username
    parts = auth.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="认证信息格式错误，应为 company:username")
    return parts[0], parts[1]


@router.post("")
async def upload_attachment(
    file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None),
    text_filename: Optional[str] = Form(None),
    auth: tuple = Depends(get_current_auth)
):
    """
    上传附件（两种方式）：
    1. file: 上传本地文件（支持所有类型）
    2. text_content + text_filename: 创建文本附件
    """
    company_name, username = auth
    attachment_id = str(uuid.uuid4())

    # 确保附件目录存在
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

    if file and file.filename:
        # 方式1: 文件上传
        filename = file.filename
        content = await file.read()
        file_size = len(content)
        mime_type = detect_mime_type(filename, content)

        # 写入文件（二进制模式）
        stored_name = _stored_filename(username, filename, attachment_id)
        file_path = os.path.join(ATTACHMENTS_DIR, stored_name)
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)

    elif text_content is not None and text_filename:
        # 方式2: 创建文本附件
        filename = text_filename
        if not any(filename.lower().endswith(ext) for ext in ['.md', '.txt']):
            filename += '.md'

        content_bytes = text_content.encode('utf-8')
        file_size = len(content_bytes)
        mime_type = 'text/markdown' if filename.endswith('.md') else 'text/plain'

        # 写入文件
        stored_name = _stored_filename(username, filename, attachment_id)
        file_path = os.path.join(ATTACHMENTS_DIR, stored_name)
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(text_content)
        content = content_bytes  # 用于后续代码
    else:
        raise HTTPException(status_code=400, detail="必须提供文件或文本内容")

    # 存储元数据
    conn = get_db_connection()
    conn.execute(
        """INSERT INTO attachments (id, company_name, filename, mime_type, file_size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (attachment_id, company_name, filename, mime_type, file_size, username)
    )
    conn.commit()
    conn.close()

    return {
        "attachment_id": attachment_id,
        "filename": filename,
        "mime_type": mime_type
    }


@router.get("/{attachment_id}")
async def get_attachment(attachment_id: str, auth: tuple = Depends(get_current_auth)):
    """
    获取附件信息
    - text/*: 返回文本内容
    - 其他: 返回元数据 + 下载链接
    """
    company_name, username = auth

    conn = get_db_connection()
    attachment = conn.execute(
        """SELECT id, filename, mime_type, file_size,
                  datetime(uploaded_at) || 'Z' as uploaded_at, uploaded_by
           FROM attachments WHERE id = ? AND company_name = ?""",
        (attachment_id, company_name)
    ).fetchone()
    conn.close()

    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    stored_name = _stored_filename(attachment["uploaded_by"], attachment["filename"], attachment["id"])
    file_path = os.path.join(ATTACHMENTS_DIR, stored_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="附件文件不存在")

    # 根据MIME类型返回
    if is_text_mime(attachment["mime_type"]):
        # 文本类型：返回内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {
            "attachment_id": attachment["id"],
            "filename": attachment["filename"],
            "mime_type": attachment["mime_type"],
            "content": content,
            "uploaded_at": attachment["uploaded_at"],
            "uploaded_by": attachment["uploaded_by"]
        }
    else:
        # 其他类型：只返回元数据 + 下载链接
        return {
            "attachment_id": attachment["id"],
            "filename": attachment["filename"],
            "mime_type": attachment["mime_type"],
            "file_size": attachment["file_size"],
            "download_url": f"/api/attachments/{attachment_id}/download",
            "uploaded_at": attachment["uploaded_at"],
            "uploaded_by": attachment["uploaded_by"]
        }


@router.get("/{attachment_id}/download")
async def download_attachment(attachment_id: str, auth: tuple = Depends(get_current_auth)):
    """
    下载附件文件（直接返回文件流）
    适用于所有非text类型文件（图片、视频、音频、二进制等）
    """
    company_name, username = auth

    conn = get_db_connection()
    attachment = conn.execute(
        """SELECT id, filename, mime_type, uploaded_by
           FROM attachments WHERE id = ? AND company_name = ?""",
        (attachment_id, company_name)
    ).fetchone()
    conn.close()

    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    stored_name = _stored_filename(attachment["uploaded_by"], attachment["filename"], attachment["id"])
    file_path = os.path.join(ATTACHMENTS_DIR, stored_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="附件文件不存在")

    return FileResponse(
        path=file_path,
        filename=attachment["filename"],
        media_type=attachment["mime_type"]
    )
