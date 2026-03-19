import os
import shutil
import sys
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException
from urllib.parse import unquote
from database import get_db_connection

# 添加项目根目录到系统路径，以便导入 util
PARENT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PARENT_DIR))

from util import get_staff_dir

router = APIRouter(prefix="/skills", tags=["技能"])


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


def get_project_root():
    """获取项目根目录"""
    return Path(__file__).parent.parent.parent


@router.get("")
async def get_all_skills():
    """获取所有可用的技能列表"""
    project_root = get_project_root()
    skills_dir = project_root / "claude" / "skills"

    if not skills_dir.exists():
        return {"skills": []}

    skills = []
    for item in skills_dir.iterdir():
        if item.is_dir() and not item.name.startswith("__"):
            skills.append(item.name)

    skills.sort()
    return {"skills": skills}


@router.get("/users/{username}")
async def get_user_skills(username: str, auth: tuple = Depends(get_current_auth)):
    """获取指定用户已安装的技能列表"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    # 验证用户存在（在同公司内）
    conn = get_db_connection()
    user = conn.execute(
        "SELECT username FROM users WHERE company_name = ? AND username = ?",
        (company_name, username)
    ).fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")

    # 路径: staff/{company}/{username}/.claude/skills/
    user_skills_dir = get_staff_dir() / company_name / username / ".claude" / "skills"

    if not user_skills_dir.exists():
        return {"skills": []}

    skills = []
    for item in user_skills_dir.iterdir():
        if item.is_dir() and not item.name.startswith("__"):
            skills.append(item.name)

    skills.sort()
    return {"skills": skills}


def _verify_user(conn, company_name: str, username: str):
    """验证用户存在"""
    user = conn.execute(
        "SELECT username FROM users WHERE company_name = ? AND username = ?",
        (company_name, username)
    ).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")


def _remove_skill_directory(company_name: str, username: str, skill: str):
    """删除用户技能目录"""
    user_skill_dir = get_staff_dir() / company_name / username / ".claude" / "skills" / skill
    if user_skill_dir.exists():
        shutil.rmtree(user_skill_dir)
    return user_skill_dir


def _copy_skill_directory(company_name: str, username: str, skill: str):
    """复制技能目录到用户目录"""
    project_root = get_project_root()
    source_skill_dir = project_root / "claude" / "skills" / skill
    target_skills_dir = get_staff_dir() / company_name / username / ".claude" / "skills"

    # 验证源技能目录存在
    if not source_skill_dir.exists():
        raise HTTPException(status_code=404, detail=f"技能 '{skill}' 不存在")

    # 验证技能是目录
    if not source_skill_dir.is_dir():
        raise HTTPException(status_code=400, detail=f"'{skill}' 不是有效的技能")

    # 创建目标skills目录
    target_skills_dir.mkdir(parents=True, exist_ok=True)

    # 复制技能目录
    target_skill_dir = target_skills_dir / skill
    if target_skill_dir.exists():
        raise HTTPException(status_code=400, detail=f"用户已安装技能 '{skill}'")

    shutil.copytree(source_skill_dir, target_skill_dir)

    # 如果是办公技能，创建 token 文件
    if skill == "办公":
        token_file_dir = target_skill_dir / "scripts"
        token_file_dir.mkdir(parents=True, exist_ok=True)
        token_file = token_file_dir / "token"
        token_file.write_text(f"{company_name}:{username}", encoding="utf-8")


@router.post("/users/{username}/skills/{skill}")
async def add_user_skill(username: str, skill: str, auth: tuple = Depends(get_current_auth)):
    """为指定用户添加技能"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        _verify_user(conn, company_name, username)
        conn.close()

        _copy_skill_directory(company_name, username, skill)

        return {"message": f"已为用户 '{company_name}:{username}' 添加技能 '{skill}'"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{username}/skills/{skill}")
async def update_user_skill(username: str, skill: str, auth: tuple = Depends(get_current_auth)):
    """为指定用户更新技能到最新版本（删除后重新安装）"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        _verify_user(conn, company_name, username)
        conn.close()

        # 先删除（如果存在）
        _remove_skill_directory(company_name, username, skill)

        # 再添加最新版本
        _copy_skill_directory(company_name, username, skill)

        return {"message": f"已为用户 '{company_name}:{username}' 更新技能 '{skill}'"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{username}/skills/{skill}")
async def remove_user_skill(username: str, skill: str, auth: tuple = Depends(get_current_auth)):
    """为指定用户删除技能（办公技能不可删除）"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    # 禁止删除办公技能
    if skill == "办公":
        raise HTTPException(status_code=403, detail="办公技能不允许删除")

    conn = get_db_connection()

    try:
        _verify_user(conn, company_name, username)
        conn.close()

        user_skill_dir = get_staff_dir() / company_name / username / ".claude" / "skills" / skill

        # 验证技能目录存在
        if not user_skill_dir.exists():
            raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 未安装技能 '{skill}'")

        # 删除技能目录
        shutil.rmtree(user_skill_dir)

        return {"message": f"已为用户 '{company_name}:{username}' 删除技能 '{skill}'"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
