import json

from database import get_db_connection
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from routes.users import get_current_auth
from typing import Optional

router = APIRouter(tags=["Timeline"])


@router.get("/claude-session-info")
async def get_user_claude_session_info(auth: tuple = Depends(get_current_auth)):
    """获取当前用户的 Claude session 信息

    返回：
    - session_id: 最后一次的 Claude session_id（从最后一次 timeline 记录中解析）
    - conversation_count: 历史对话轮数（timeline 记录总数）
    """
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

        # 统计历史对话轮数
        count_result = conn.execute(
            """SELECT COUNT(*) as count FROM user_timelines
               WHERE company_name = ? AND username = ?""",
            (company_name, username)
        ).fetchone()
        conversation_count = count_result["count"] if count_result else 0

        # 获取最后一次 timeline 记录（按时间降序取第一条）
        latest_timeline = conn.execute(
            """SELECT output FROM user_timelines
               WHERE company_name = ? AND username = ?
               ORDER BY timestamp DESC
               LIMIT 1""",
            (company_name, username)
        ).fetchone()
        conn.close()

        session_id = None
        if latest_timeline:
            try:
                # 解析 output（JSON 数组）
                output_data = json.loads(latest_timeline["output"])
                if isinstance(output_data, list) and len(output_data) > 0:
                    # 取第一个元素，查找 session_id 字段
                    first_item = output_data[0]
                    if isinstance(first_item, dict) and "session_id" in first_item:
                        session_id = first_item["session_id"]
            except (json.JSONDecodeError, KeyError, TypeError):
                # JSON 解析失败或数据格式不符，session_id 保持为 None
                pass

        return {
            "session_id": session_id,
            "conversation_count": conversation_count
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{username}")
async def get_user_timeline(
    username: str,
    index: Optional[int] = Query(None, description="索引值，-1 表示获取最后一条"),
    auth: tuple = Depends(get_current_auth)
):
    """获取指定用户的 timeline 记录

    参数：
    - index: 可选的索引值
      - 不传：返回所有记录（向后兼容）
      - -1：返回最后一条记录和总条数
      - 其他值：返回指定索引的记录和总条数
    """
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

        # 如果没有传 index，保持原有行为（返回所有记录）
        if index is None:
            timelines = conn.execute(
                """SELECT id, timestamp, output, duration, start_time, end_time
                   FROM user_timelines
                   WHERE company_name = ? AND username = ?
                   ORDER BY timestamp ASC""",
                (company_name, username)
            ).fetchall()
            conn.close()

            return [
                {
                    "id": row["id"],
                    "timestamp": row["timestamp"],
                    "output": row["output"],
                    "duration": row["duration"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"]
                }
                for row in timelines
            ]

        # 获取总条数
        count_result = conn.execute(
            """SELECT COUNT(*) as count FROM user_timelines
               WHERE company_name = ? AND username = ?""",
            (company_name, username)
        ).fetchone()
        total = count_result["count"] if count_result else 0

        if total == 0:
            conn.close()
            return {
                "entry": None,
                "total": 0,
                "index": 0
            }

        # 计算实际索引
        if index == -1:
            # 获取最后一条
            actual_index = total - 1
        else:
            # 使用传入的索引，但限制在有效范围内
            actual_index = max(0, min(index, total - 1))

        # 获取指定索引的记录
        row = conn.execute(
            """SELECT id, timestamp, output, duration, start_time, end_time
               FROM user_timelines
               WHERE company_name = ? AND username = ?
               ORDER BY timestamp ASC
               LIMIT 1 OFFSET ?""",
            (company_name, username, actual_index)
        ).fetchone()
        conn.close()

        return {
            "entry": {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "output": row["output"],
                "duration": row["duration"],
                "start_time": row["start_time"],
                "end_time": row["end_time"]
            } if row else None,
            "total": total,
            "index": actual_index
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def add_user_timeline(data: dict, auth: tuple = Depends(get_current_auth)):
    """添加用户的 timeline 记录"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    output = data.get("output")
    if not output:
        raise HTTPException(status_code=400, detail="缺少 output 字段")

    duration = data.get("duration")
    start_time = data.get("start_time")
    end_time = data.get("end_time")

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

        # 插入 timeline 记录
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO user_timelines (company_name, username, timestamp, output, duration, start_time, end_time)
               VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)""",
            (company_name, username, output, duration, start_time, end_time)
        )
        conn.commit()
        conn.close()

        return {"message": "Timeline 记录已添加"}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
