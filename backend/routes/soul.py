from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from models import SoulUpdate
from routes.users import get_current_auth

router = APIRouter(prefix="/soul", tags=["Soul"])


@router.get("/{username}")
async def get_soul(username: str, auth: tuple = Depends(get_current_auth)):
    """读取用户的Soul文件内容"""
    company_name, _ = auth

    soul_path = Path(__file__).parent.parent.parent / "Soul" / company_name / f"{username}.md"

    if not soul_path.exists():
        raise HTTPException(status_code=404, detail=f"用户 '{company_name}:{username}' 的Soul文件不存在")

    try:
        with open(soul_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"company_name": company_name, "username": username, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")


@router.put("/{username}")
async def update_soul(username: str, soul: SoulUpdate, auth: tuple = Depends(get_current_auth)):
    """更新用户的Soul文件内容"""
    company_name, _ = auth

    soul_path = Path(__file__).parent.parent.parent / "Soul" / company_name / f"{username}.md"

    try:
        # 确保目录存在
        soul_path.parent.mkdir(parents=True, exist_ok=True)

        with open(soul_path, "w", encoding="utf-8") as f:
            f.write(soul.content)

        return {"company_name": company_name, "username": username, "message": "Soul文件已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")


@router.get("/company/{company_name}")
async def get_company_soul(company_name: str, auth: tuple = Depends(get_current_auth)):
    """读取公司的Soul文件内容"""
    # 验证请求者是否属于该公司（可选）
    current_company, _ = auth

    soul_path = Path(__file__).parent.parent.parent / "Soul" / f"{company_name}.md"

    if not soul_path.exists():
        raise HTTPException(status_code=404, detail=f"公司 '{company_name}' 的Soul文件不存在")

    try:
        with open(soul_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"company_name": company_name, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")


@router.put("/company/{company_name}")
async def update_company_soul(company_name: str, soul: SoulUpdate, auth: tuple = Depends(get_current_auth)):
    """更新公司的Soul文件内容"""
    # 验证请求者是否属于该公司（可选）
    current_company, _ = auth

    soul_path = Path(__file__).parent.parent.parent / "Soul" / f"{company_name}.md"

    try:
        # 确保Soul目录存在
        soul_path.parent.mkdir(parents=True, exist_ok=True)

        with open(soul_path, "w", encoding="utf-8") as f:
            f.write(soul.content)

        return {"company_name": company_name, "message": "公司Soul文件已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")
