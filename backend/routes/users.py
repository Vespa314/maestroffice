import os
import shutil
import sqlite3
import sys
from pathlib import Path
from urllib.parse import unquote

from database import MASTER_STAFF, get_db_connection
from fastapi import APIRouter, Depends, Header, HTTPException, Query

# 添加项目根目录到系统路径，以便导入 util
PARENT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PARENT_DIR))

from models import (
    CompanyCreate,
    UserCreate,
    UserOnDutyUpdate,
    UserWorkingStatusUpdate,
)
from routes.websocket import manager

from util import get_staff_dir

router = APIRouter(prefix="/users", tags=["用户"])


def _setup_user_directory(company_name: str, username: str):
    """创建用户目录结构并复制必要的文件"""
    project_root = Path(__file__).parent.parent.parent
    staff_user_dir = get_staff_dir() / company_name / username
    claude_source_dir = project_root / "claude"
    claude_target_dir = staff_user_dir / ".claude"
    token_file_dir = claude_target_dir / "skills" / "办公" / "scripts"

    # 创建用户目录
    staff_user_dir.mkdir(parents=True, exist_ok=True)

    # 创建 Memory.md 文件
    memory_file = staff_user_dir / "Memory.md"
    if not memory_file.exists():
        memory_file.write_text("", encoding="utf-8")

    # 复制办公 skill 到 .claude/skills/办公
    if claude_source_dir.exists():
        office_skill_source = claude_source_dir / "skills" / "办公"
        if office_skill_source.exists():
            # 创建目标目录结构
            token_file_dir.mkdir(parents=True, exist_ok=True)

            # 复制办公 skill
            office_skill_target = claude_target_dir / "skills" / "办公"
            if office_skill_target.exists():
                shutil.rmtree(office_skill_target)
            shutil.copytree(office_skill_source, office_skill_target)

            # 创建 token 文件，格式: company:username
            token_file = token_file_dir / "token"
            token_file.write_text(f"{company_name}:{username}", encoding="utf-8")


async def get_current_auth(x_auth: str = Header(None)) -> tuple:
    """从header获取当前认证信息 (company_name, username)"""
    if not x_auth:
        raise HTTPException(status_code=401, detail="缺少认证信息")
    # 解码URL编码的认证信息（支持中文等非ASCII字符）
    auth = unquote(x_auth)
    # 格式: company_name:username
    # 特殊情况: company_name: (username为空) 用于获取公司列表等公共接口
    parts = auth.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="认证信息格式错误，应为 company:username")
    return parts[0], parts[1]


# ============= 公司管理 API =============

@router.get("/companies")
async def get_all_companies():
    """获取所有公司列表"""
    conn = get_db_connection()
    companies = conn.execute("SELECT name, datetime(created_at) || 'Z' as created_at FROM companies ORDER BY name").fetchall()
    conn.close()
    return [
        {"name": row["name"], "created_at": row["created_at"]}
        for row in companies
    ]


@router.get("/companies/recommended")
async def get_recommended_companies():
    """获取推荐公司列表（Soul目录下的一级文件夹名字）"""
    conn = get_db_connection()

    try:
        # 获取数据库中已存在的公司列表
        existing_companies = conn.execute("SELECT name FROM companies").fetchall()
        existing_company_names = {row["name"] for row in existing_companies}
        conn.close()

        # 获取 Soul 目录下的一级文件夹
        project_root = Path(__file__).parent.parent.parent
        soul_dir = project_root / "Soul"
        recommended_companies = []

        if soul_dir.exists():
            for item in soul_dir.iterdir():
                # 只返回文件夹且不在数据库中的公司
                if item.is_dir() and item.name not in existing_company_names:
                    recommended_companies.append(item.name)

        # 按字母顺序排序
        recommended_companies.sort()

        return {"companies": recommended_companies}

    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/companies")
async def create_company(company: CompanyCreate):
    """创建公司"""
    conn = get_db_connection()
    try:
        # 检查公司是否已存在
        existing = conn.execute("SELECT name FROM companies WHERE name = ?", (company.name,)).fetchone()
        if existing:
            conn.close()
            raise HTTPException(status_code=400, detail=f"公司 '{company.name}' 已存在")

        # 创建公司
        conn.execute("INSERT INTO companies (name) VALUES (?)", (company.name,))

        # 创建公司目录
        company_dir = get_staff_dir() / company.name
        company_dir.mkdir(parents=True, exist_ok=True)

        project_root = Path(__file__).parent.parent.parent
        # 创建公司soul文件（如果不存在）
        company_soul_path = project_root / "Soul" / f"{company.name}.md"
        if not company_soul_path.exists():
            company_soul_path.parent.mkdir(parents=True, exist_ok=True)
            company_soul_path.touch()

        # 创建默认MASTER_STAFF用户
        master_staff_username = MASTER_STAFF
        conn.execute(
            "INSERT INTO users (company_name, username) VALUES (?, ?)",
            (company.name, master_staff_username)
        )

        # 设置MASTER_STAFF用户目录
        _setup_user_directory(company.name, master_staff_username)

        conn.commit()
        conn.close()
        return {"name": company.name}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{company_name}/users")
async def get_company_users(company_name: str):
    """获取指定公司的用户列表"""
    conn = get_db_connection()
    # 验证公司存在
    company = conn.execute("SELECT name FROM companies WHERE name = ?", (company_name,)).fetchone()
    if not company:
        conn.close()
        raise HTTPException(status_code=404, detail=f"公司 '{company_name}' 不存在")

    users = conn.execute(
        "SELECT company_name, username, is_on_duty FROM users WHERE company_name = ? ORDER BY username",
        (company_name,)
    ).fetchall()
    conn.close()
    return [
        {"company_name": row["company_name"], "username": row["username"], "is_on_duty": bool(row["is_on_duty"])}
        for row in users
    ]


# ============= 用户管理 API =============

@router.get("")
async def get_all_users(
    full_detail: bool = Query(True, description="是否返回详细信息"),
    auth: tuple = Depends(get_current_auth)
):
    """获取当前公司的用户列表"""
    company_name, username = auth

    # 允许 company: 格式（username为空）用于登录前获取用户列表
    if not username:
        if not company_name:
            raise HTTPException(status_code=401, detail="缺少公司信息")
    else:
        # 验证用户存在
        conn = get_db_connection()
        user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (company_name, username)
        ).fetchone()
        conn.close()
        if not user:
            raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")

    conn = get_db_connection()
    if full_detail:
        users = conn.execute(
            "SELECT company_name, username, is_on_duty FROM users WHERE company_name = ? ORDER BY username",
            (company_name,)
        ).fetchall()
        conn.close()
        return [
            {"company_name": row["company_name"], "username": row["username"], "is_on_duty": bool(row["is_on_duty"])}
            for row in users
        ]
    else:
        users = conn.execute(
            "SELECT username FROM users WHERE company_name = ? ORDER BY username",
            (company_name,)
        ).fetchall()
        conn.close()
        return [{"username": row["username"]} for row in users]


@router.patch("/{username}/on-duty")
async def update_user_on_duty(username: str, data: UserOnDutyUpdate, auth: tuple = Depends(get_current_auth)):
    """更新用户到岗状态"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()
    try:
        # 检查用户是否存在（在同公司内）
        user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (company_name, username)
        ).fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")

        # 更新到岗状态
        conn.execute(
            "UPDATE users SET is_on_duty = ? WHERE company_name = ? AND username = ?",
            (1 if data.is_on_duty else 0, company_name, username)
        )
        conn.commit()
        conn.close()
        return {"company_name": company_name, "username": username, "is_on_duty": data.is_on_duty}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_user(user: UserCreate, auth: tuple = Depends(get_current_auth)):
    """添加用户（允许在未登录时调用，格式: company_name:）"""
    company_name, current_username = auth

    if not company_name:
        raise HTTPException(status_code=401, detail="缺少公司信息")

    # 验证请求中的 company_name 与认证中的 company_name 一致
    if user.company_name != company_name:
        raise HTTPException(status_code=403, detail="只能为当前认证的公司创建用户")

    # 验证公司存在
    conn = get_db_connection()
    company = conn.execute("SELECT name FROM companies WHERE name = ?", (user.company_name,)).fetchone()
    if not company:
        conn.close()
        raise HTTPException(status_code=400, detail=f"公司 '{user.company_name}' 不存在")

    # 如果有当前用户，验证当前用户也在该公司
    if current_username:
        current_user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (user.company_name, current_username)
        ).fetchone()
        if not current_user:
            conn.close()
            raise HTTPException(status_code=403, detail="您只能在所属公司创建用户")

    try:
        # 先插入数据库但不提交
        conn.execute(
            "INSERT INTO users (company_name, username) VALUES (?, ?)",
            (user.company_name, user.username)
        )

        # 创建用户目录结构
        _setup_user_directory(user.company_name, user.username)

        # 文件系统操作成功后才提交数据库
        conn.commit()
        conn.close()
        return {"company_name": user.company_name, "username": user.username}

    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail=f"用户 '{user.company_name}:{user.username}' 已存在")
    except OSError as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"文件系统操作失败: {str(e)}")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommended")
async def get_recommended_users(auth: tuple = Depends(get_current_auth)):
    """获取推荐用户列表（Soul目录下有md文件但不在用户列表中的用户）"""
    company_name, _ = auth

    if not company_name:
        raise HTTPException(status_code=401, detail="缺少公司信息")

    conn = get_db_connection()

    try:
        # 获取数据库中该公司已存在的用户列表
        existing_users = conn.execute(
            "SELECT username FROM users WHERE company_name = ?",
            (company_name,)
        ).fetchall()
        existing_usernames = {row["username"] for row in existing_users}
        conn.close()

        # 获取 Soul 目录下特定公司目录中的所有 .md 文件
        # Soul目录结构: Soul/{company_name}/{username}.md
        project_root = Path(__file__).parent.parent.parent
        company_soul_dir = project_root / "Soul" / company_name
        recommended_users = []

        if company_soul_dir.exists():
            for filename in os.listdir(company_soul_dir):
                if filename.endswith(".md"):
                    # 去掉 .md 后缀得到用户名
                    username = filename[:-3]
                    # 只返回不在数据库中的用户
                    if username not in existing_usernames:
                        recommended_users.append(username)

        # 按字母顺序排序
        recommended_users.sort()

        return {"users": recommended_users}

    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{username}")
async def delete_user(username: str, auth: tuple = Depends(get_current_auth)):
    """删除用户（同时删除该用户在staff目录下的文件夹）"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()
    try:
        # 检查用户是否存在（在同公司内）
        user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (company_name, username)
        ).fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")

        # 手动清理相关数据（确保级联删除正确执行）
        # 1. 删除对话成员关系
        conn.execute(
            "DELETE FROM conversation_members WHERE company_name = ? AND username = ?",
            (company_name, username)
        )
        # 2. 删除用户对话读取位置
        conn.execute(
            "DELETE FROM user_conversation_reads WHERE company_name = ? AND username = ?",
            (company_name, username)
        )
        # 3. 删除用户本身
        conn.execute(
            "DELETE FROM users WHERE company_name = ? AND username = ?",
            (company_name, username)
        )

        conn.commit()
        conn.close()

        # 删除用户目录: staff/{company}/{username}/
        staff_user_dir = get_staff_dir() / company_name / username

        if staff_user_dir.exists():
            shutil.rmtree(staff_user_dir)

        return {"message": f"用户 '{company_name}:{username}' 已删除"}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


# ============= 员工工作状态管理 API =============

@router.get("/working-status")
async def get_all_users_working_status(auth: tuple = Depends(get_current_auth)):
    """获取当前公司所有员工的工作状态"""
    company_name, _ = auth

    if not company_name:
        raise HTTPException(status_code=401, detail="缺少公司信息")

    conn = get_db_connection()
    try:
        # 优化：使用 LEFT JOIN 单次查询获取所有用户及其工作状态
        results = conn.execute("""
            SELECT
                u.company_name,
                u.username,
                COALESCE(uws.is_working, 0) as is_working
            FROM users u
            LEFT JOIN user_working_status uws
                ON u.company_name = uws.company_name
                AND u.username = uws.username
            WHERE u.company_name = ?
            ORDER BY u.username
        """, (company_name,)).fetchall()

        conn.close()
        return [
            {
                "company_name": row["company_name"],
                "username": row["username"],
                "is_working": bool(row["is_working"])
            }
            for row in results
        ]

    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/working-status")
async def update_user_working_status(data: UserWorkingStatusUpdate, auth: tuple = Depends(get_current_auth)):
    """更新当前认证用户的工作状态"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()
    try:
        # 检查用户是否存在
        user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (company_name, username)
        ).fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 不存在")

        # 使用 UPSERT 语法（SQLite 3.24+）插入或更新工作状态
        conn.execute(
            """INSERT INTO user_working_status (company_name, username, is_working)
               VALUES (?, ?, ?)
               ON CONFLICT(company_name, username) DO UPDATE SET is_working = excluded.is_working""",
            (company_name, username, 1 if data.is_working else 0)
        )

        conn.commit()
        conn.close()

        await manager.broadcast_to_company(
            company_name,
            {
                "type": "working_status_update",
                "company_name": company_name,
                "username": username,
                "is_working": data.is_working
            }
        )

        return {
            "company_name": company_name,
            "username": username,
            "is_working": data.is_working
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/working-status/clear-all")
async def clear_all_users_working_status():
    """清空所有员工的工作状态（设置为不工作）"""
    conn = get_db_connection()
    try:
        # 获取所有有工作状态的员工
        statuses = conn.execute("SELECT company_name, username FROM user_working_status").fetchall()

        # 更新所有状态为不工作
        conn.execute("UPDATE user_working_status SET is_working = 0")

        conn.commit()
        conn.close()

        # 按公司分组广播
        companies = {}
        for status in statuses:
            company = status["company_name"]
            username = status["username"]
            if company not in companies:
                companies[company] = []
            companies[company].append(username)

        for company, usernames in companies.items():
            for username in usernames:
                await manager.broadcast_to_company(
                    company,
                    {
                        "type": "working_status_update",
                        "company_name": company,
                        "username": username,
                        "is_working": False
                    }
                )

        return {"message": "所有员工工作状态已清空"}

    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
