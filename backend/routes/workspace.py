import os
import sys
from pathlib import Path
from typing import Any, Dict
from urllib.parse import unquote_to_bytes

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse

# 添加项目根目录到系统路径，以便导入 util
PARENT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PARENT_DIR))

from util import get_staff_dir

router = APIRouter(prefix="/workspace", tags=["Workspace"])


def build_file_tree(path: Path, relative_path: str = "") -> Dict[str, Any]:
    """递归构建文件树结构"""
    node: Dict[str, Any] = {
        "uri": relative_path if relative_path else ".",
        "type": "directory" if path.is_dir() else "file",
        "name": path.name,
    }

    if path.is_file():
        # 如果是文件，添加文件元数据
        node["size"] = path.stat().st_size
        node["modified"] = path.stat().st_mtime
        return node

    # 如果是目录，递归处理子项
    children = []
    try:
        for item in sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name)):
            # 忽略 .claude 目录
            if item.name == ".claude":
                continue

            item_relative_path = f"{relative_path}/{item.name}" if relative_path else item.name
            child_node = build_file_tree(item, item_relative_path)
            children.append(child_node)
    except PermissionError:
        # 如果没有权限访问某个目录，跳过
        pass

    if children:
        node["children"] = children

    return node


async def get_current_auth(x_auth: str = Header(None)) -> tuple:
    """从header获取当前认证信息 (company_name, username)"""
    if not x_auth:
        raise HTTPException(status_code=401, detail="缺少认证信息")

    # 解码URL编码的认证信息（支持中文等非ASCII字符）
    # 前端使用 encodeURIComponent，需要解码
    if '%' in x_auth:
        # 已编码，使用 unquote_to_bytes 然后 decode 为 UTF-8
        auth_bytes = unquote_to_bytes(x_auth)
        auth = auth_bytes.decode('utf-8')
    else:
        # 未编码，直接使用
        auth = x_auth

    # 格式: company_name:username
    parts = auth.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="认证信息格式错误，应为 company:username")
    return parts[0], parts[1]


@router.get("/{role}/files")
async def get_workspace_files(role: str, auth: tuple = Depends(get_current_auth)):
    """获取用户workspace目录下的文件树结构"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    # 路径: staff/{company}/{role}/
    workspace_path = get_staff_dir() / company_name / role

    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{role}' 的workspace目录不存在")

    try:
        # 构建文件树
        tree = build_file_tree(workspace_path)

        # 不返回员工名这一级，直接返回其子内容
        # 如果有子节点，将它们作为根节点，并默认展开所有目录
        if "children" in tree and tree["children"]:
            # 构建一个新的虚拟根节点，包含所有子项
            result_tree = {
                "uri": ".",
                "type": "directory",
                "name": ".",
                "children": tree["children"],
                "expanded": True
            }
            return {"role": role, "tree": result_tree}
        else:
            # 空目录
            return {
                "role": role,
                "tree": {
                    "uri": ".",
                    "type": "directory",
                    "name": ".",
                    "expanded": True
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取目录失败: {str(e)}")


@router.get("/{role}/files/{filename:path}/download")
async def download_workspace_file(role: str, filename: str, auth: tuple = Depends(get_current_auth)):
    """下载工作台文件（返回二进制数据）

    用于图片等二进制文件的预览和下载

    注意：此路由必须在 /{role}/files/{filename:path} 之前定义，否则会被拦截
    """
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    # 路径: staff/{company}/{role}/{filename}
    file_path = get_staff_dir() / company_name / role / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 '{filename}' 不存在")

    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"'{filename}' 不是一个文件")

    # 检测 MIME 类型
    import mimetypes
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        # 默认二进制流
        mime_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        filename=Path(filename).name,
        media_type=mime_type
    )


@router.get("/{role}/files/{filename:path}")
async def get_workspace_file(role: str, filename: str, auth: tuple = Depends(get_current_auth)):
    """读取用户workspace目录下的具体文件内容

    Args:
        role: 角色（用户名）
        filename: 文件路径，可以是相对路径（如 "dir/file.txt"）或文件名
        auth: 认证信息 (company_name, username)
    """
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    # 路径: staff/{company}/{role}/{filename}
    # filename 可以是相对路径，所以直接拼接即可
    file_path = get_staff_dir() / company_name / role / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 '{filename}' 不存在")

    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"'{filename}' 不是一个文件")

    try:
        # 尝试读取文件内容
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        return {
            "role": role,
            "filename": filename,
            "content": content,
            "size": file_path.stat().st_size
        }
    except UnicodeDecodeError:
        # 如果不是文本文件，返回基本信息
        return {
            "role": role,
            "filename": filename,
            "content": None,
            "message": "文件是二进制文件，无法以文本形式读取",
            "size": file_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")


@router.put("/{role}/files/{filename}")
async def update_workspace_file(role: str, filename: str, content: str, auth: tuple = Depends(get_current_auth)):
    """更新用户workspace目录下的文件内容"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    # 路径: staff/{company}/{username}/{filename}
    file_path = get_staff_dir() / company_name / role / filename

    try:
        # 确保目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "role": role,
            "filename": filename,
            "message": "文件已更新"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")
