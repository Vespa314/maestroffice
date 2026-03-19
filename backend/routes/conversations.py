import sqlite3
import uuid
from urllib.parse import unquote

from database import get_db_connection, is_master_staff, verify_user_in_conversation
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from models import (
    ConversationCreate,
    ConversationMemberAdd,
    ConversationMembersBatchAdd,
    ConversationUpdate,
)

from .websocket import manager

router = APIRouter(prefix="/conversations", tags=["对话"])


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
async def create_conversation(
    conversation: ConversationCreate,
    auth: tuple = Depends(get_current_auth)
):
    """创建对话"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conversation_id = str(uuid.uuid4())
    conn = get_db_connection()

    try:
        # 添加成员：当前用户 + 指定的成员（去重）
        all_members = list(set([username] + conversation.members))

        # 校验：对话至少需要2个成员
        if len(all_members) < 2:
            conn.close()
            raise HTTPException(status_code=400, detail="对话至少需要2个成员")

        # 批量验证所有用户是否存在（优化：单次查询替代多次查询）
        placeholders = ",".join(["?" for _ in all_members])
        valid_users = conn.execute(
            f"SELECT username FROM users WHERE company_name = ? AND username IN ({placeholders})",
            (company_name, *all_members)
        ).fetchall()
        valid_usernames = {u["username"] for u in valid_users}

        # 检查是否有不存在的用户
        invalid_users = [u for u in all_members if u not in valid_usernames]
        if invalid_users:
            conn.close()
            invalid_user_list = ', '.join([f"{company_name}:{u}" for u in invalid_users])
            raise HTTPException(
                status_code=400,
                detail=f"以下用户不存在: {invalid_user_list}"
            )

        # 创建对话
        conn.execute(
            "INSERT INTO conversations (id, company_name, title) VALUES (?, ?, ?)",
            (conversation_id, company_name, conversation.title)
        )

        # 批量添加成员（优化：单次批量插入替代循环插入）
        member_records = [(conversation_id, company_name, member) for member in all_members]
        conn.executemany(
            "INSERT INTO conversation_members (conversation_id, company_name, username) VALUES (?, ?, ?)",
            member_records
        )

        conn.commit()

        # 获取对话信息（用于通知成员）
        conv_info = conn.execute(
            "SELECT title FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        # 获取创建时间
        created_at = conn.execute(
            "SELECT datetime(created_at) || 'Z' as created_at FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()["created_at"]

        conn.close()

        # 通知所有成员（包括创建者）
        for member in all_members:
            await manager.send_to_user(
                company_name,
                member,
                {
                    "type": "added_to_conversation",
                    "conversation": {
                        "conversation_id": conversation_id,
                        "title": conv_info["title"],
                        "announcement": None,
                        "members": all_members,
                        "created_at": created_at,
                        "message_count": 0,
                        "unread_count": 0
                    }
                }
            )

        # 额外通知MASTER_STAFF（如果在线且不在对话成员中）
        from database import MASTER_STAFF
        master_staff_key = (company_name, MASTER_STAFF)
        print(f"[DEBUG] Creating conversation - MASTER_STAFF: {MASTER_STAFF}, master_staff_key: {master_staff_key}")
        print(f"[DEBUG] Active connections: {list(manager.active_connections.keys())}")
        print(f"[DEBUG] MASTER_STAFF online: {master_staff_key in manager.active_connections}, MASTER_STAFF in members: {MASTER_STAFF in all_members}")
        if master_staff_key in manager.active_connections and MASTER_STAFF not in all_members:
            print(f"[DEBUG] Sending conversation_created notification to MASTER_STAFF {MASTER_STAFF}")
            await manager.send_to_user(
                company_name,
                MASTER_STAFF,
                {
                    "type": "conversation_created",
                    "conversation": {
                        "conversation_id": conversation_id,
                        "title": conv_info["title"],
                        "announcement": None,
                        "members": all_members,
                        "created_at": created_at,
                        "message_count": 0,
                        "unread_count": 0,
                        "is_member": False  # MASTER_STAFF 不在对话中
                    }
                }
            )
        else:
            print(f"[DEBUG] MASTER_STAFF notification not sent - online: {master_staff_key in manager.active_connections}, in_members: {MASTER_STAFF in all_members}")

        return {"conversation_id": conversation_id}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_all_conversations(
    unread_only: bool = Query(False, description="是否只返回有未读消息的对话"),
    include_empty: bool = Query(False, description="是否返回没有消息的对话"),
    only_member_conversations: bool = Query(False, description="是否只返回自己是成员的对话"),
    include_last_message: bool = Query(False, description="是否返回最后一条消息的预览信息"),
    auth: tuple = Depends(get_current_auth)
):
    """获取当前用户参与的对话列表（管理员可获取所有对话）"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    # 检查是否是管理员（only_member_conversations=True 时，即使是 MASTER_STAFF 也不作为管理员）
    is_admin = is_master_staff(company_name, username) and not only_member_conversations

    # 基础查询：获取用户参与的对话（按公司过滤）
    if unread_only:
        # 只返回有未读消息的对话
        if is_admin:
            # 管理员：获取公司内所有对话（未读消息数量为0，因为管理员不在对话中）
            conversations = conn.execute("""
                SELECT DISTINCT c.id, c.title, c.announcement, datetime(c.created_at) || 'Z' as created_at
                FROM conversations c
                WHERE c.company_name = ?
                """ + ("" if include_empty else "AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND company_name = c.company_name)") + """
                ORDER BY c.created_at DESC
            """, (company_name,)).fetchall()
        else:
            conversations = conn.execute("""
                SELECT DISTINCT c.id, c.title, c.announcement, datetime(c.created_at) || 'Z' as created_at
                FROM conversations c
                INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND c.company_name = cm.company_name
                WHERE cm.company_name = ? AND cm.username = ?
                """ + ("" if include_empty else "AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND company_name = c.company_name)") + """
                AND EXISTS (
                    -- 检查该对话是否有未读消息
                    SELECT 1
                    FROM messages m
                    LEFT JOIN user_conversation_reads ucr ON
                        cm.company_name = ucr.company_name AND
                        cm.username = ucr.username AND
                        cm.conversation_id = ucr.conversation_id
                    WHERE m.conversation_id = c.id AND m.company_name = c.company_name
                    AND (
                        ucr.last_read_message_id IS NULL OR
                        m.created_at > (
                            SELECT created_at
                            FROM messages
                            WHERE id = ucr.last_read_message_id
                        )
                    )
                )
                ORDER BY c.created_at DESC
            """, (company_name, username)).fetchall()
    else:
        # 返回所有对话
        if is_admin:
            # 管理员：获取公司内所有对话
            conversations = conn.execute("""
                SELECT c.id, c.title, c.announcement, datetime(c.created_at) || 'Z' as created_at
                FROM conversations c
                WHERE c.company_name = ?
                """ + ("" if include_empty else "AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND company_name = c.company_name)") + """
                ORDER BY c.created_at DESC
            """, (company_name,)).fetchall()
        else:
            conversations = conn.execute("""
                SELECT c.id, c.title, c.announcement, datetime(c.created_at) || 'Z' as created_at
                FROM conversations c
                INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND c.company_name = cm.company_name
                WHERE cm.company_name = ? AND cm.username = ?
                """ + ("" if include_empty else "AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND company_name = c.company_name)") + """
                ORDER BY c.created_at DESC
            """, (company_name, username)).fetchall()

    result = []
    for conv in conversations:
        members = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? ORDER BY username",
            (conv["id"], company_name)
        ).fetchall()
        member_list = [m["username"] for m in members]

        # 检查当前用户是否在对话中
        is_member = username in member_list

        # 计算该对话的消息总数
        total_count = conn.execute(
            "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND company_name = ?",
            (conv["id"], company_name)
        ).fetchone()["count"]

        # 计算该对话的未读消息数量
        # 管理员如果在对话中，也需要计算未读消息；如果不在，未读数量为0
        unread_count = 0
        if is_member:
            unread_count = conn.execute("""
                SELECT COUNT(*) as count
                FROM messages m
                LEFT JOIN user_conversation_reads ucr ON
                    ? = ucr.company_name AND
                    ? = ucr.username AND
                    m.conversation_id = ucr.conversation_id
                WHERE m.conversation_id = ? AND m.company_name = ?
                AND (
                    ucr.last_read_message_id IS NULL OR
                    m.created_at > (
                        SELECT created_at
                        FROM messages
                        WHERE id = ucr.last_read_message_id
                    )
                )
            """, (company_name, username, conv["id"], company_name)).fetchone()["count"]

        # 构建对话基本信息
        conversation_data = {
            "conversation_id": conv["id"],
            "title": conv["title"],
            "announcement": conv["announcement"],
            "members": member_list,
            "created_at": conv["created_at"],
            "message_count": total_count,
            "unread_count": unread_count,
            "is_member": is_member
        }

        # 如果需要返回最后一条消息预览
        if include_last_message and total_count > 0:
            # 获取最后一条消息
            last_message = conn.execute("""
                SELECT m.id, m.sender, m.content, datetime(m.created_at) || 'Z' as created_at
                FROM messages m
                WHERE m.conversation_id = ? AND m.company_name = ?
                ORDER BY m.created_at DESC
                LIMIT 1
            """, (conv["id"], company_name)).fetchone()

            if last_message:
                # 生成消息预览内容
                preview_content = last_message["content"] if last_message["content"] else ""

                # 检查是否有附件
                attachments = conn.execute("""
                    SELECT a.filename, a.mime_type
                    FROM attachments a
                    INNER JOIN message_attachments ma ON a.id = ma.attachment_id
                    WHERE ma.message_id = ?
                """, (last_message["id"],)).fetchall()

                if attachments:
                    # 如果有附件，根据附件类型生成预览
                    if len(attachments) == 1:
                        att = attachments[0]
                        if att["mime_type"].startswith("image/"):
                            preview_content = "[图片]"
                        elif att["mime_type"].startswith("video/"):
                            preview_content = "[视频]"
                        elif att["mime_type"].startswith("audio/"):
                            preview_content = "[音频]"
                        else:
                            preview_content = f"[文件] {att['filename']}"
                    else:
                        preview_content = f"[{len(attachments)}个文件]"

                # 截断文本消息（前100个字符）
                if preview_content and not preview_content.startswith("["):
                    if len(preview_content) > 100:
                        preview_content = preview_content[:100] + "..."

                conversation_data["last_message_preview"] = {
                    "message_id": last_message["id"],
                    "sender": last_message["sender"],
                    "content": preview_content
                }

        result.append(conversation_data)

    conn.close()
    return {"conversations": result}


@router.put("/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    conversation: ConversationUpdate,
    auth: tuple = Depends(get_current_auth)
):
    """更新对话信息（标题、公告）"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        # 验证对话存在并属于该公司
        conv = conn.execute(
            "SELECT id, company_name FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()
        if not conv:
            conn.close()
            raise HTTPException(status_code=404, detail="对话不存在")

        if conv["company_name"] != company_name:
            conn.close()
            raise HTTPException(status_code=403, detail="无权访问此对话")

        # 验证当前用户在对话中
        verify_user_in_conversation(conn, conversation_id, company_name, username)

        # 构建更新语句
        update_fields = []
        update_values = []

        if conversation.title is not None:
            update_fields.append("title = ?")
            update_values.append(conversation.title)

        if conversation.announcement is not None:
            # 验证公告长度不超过200个字符
            if len(conversation.announcement) > 200:
                conn.close()
                raise HTTPException(status_code=400, detail="公告内容不能超过200个字符")
            update_fields.append("announcement = ?")
            update_values.append(conversation.announcement)

        if not update_fields:
            conn.close()
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")

        update_values.append(conversation_id)
        update_sql = f"UPDATE conversations SET {', '.join(update_fields)} WHERE id = ?"

        conn.execute(update_sql, update_values)
        conn.commit()
        conn.close()

        return {"message": "对话信息已更新"}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{conversation_id}/members")
async def add_conversation_member(
    conversation_id: str,
    member_data: ConversationMemberAdd,
    auth: tuple = Depends(get_current_auth)
):
    """添加成员到对话"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        # 验证对话存在并属于该公司
        conv = conn.execute(
            "SELECT id, company_name FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()
        if not conv:
            conn.close()
            raise HTTPException(status_code=404, detail="对话不存在")

        if conv["company_name"] != company_name:
            conn.close()
            raise HTTPException(status_code=403, detail="无权访问此对话")

        # 验证当前用户在对话中
        verify_user_in_conversation(conn, conversation_id, company_name, username)

        # 验证要添加的用户存在（必须在同公司）
        user = conn.execute(
            "SELECT username FROM users WHERE company_name = ? AND username = ?",
            (company_name, member_data.username)
        ).fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=400, detail=f"用户 '{company_name}:{member_data.username}' 不存在")

        # 检查用户是否已在对话中
        existing_member = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username = ?",
            (conversation_id, company_name, member_data.username)
        ).fetchone()
        if existing_member:
            conn.close()
            raise HTTPException(status_code=400, detail="用户已在此对话中")

        # 添加成员
        conn.execute(
            "INSERT INTO conversation_members (conversation_id, company_name, username) VALUES (?, ?, ?)",
            (conversation_id, company_name, member_data.username)
        )
        conn.commit()

        # 获取对话信息
        conv_info = conn.execute(
            "SELECT title, announcement FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        # 获取所有成员（包括新添加的成员）
        members = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchall()
        member_list = [m["username"] for m in members]

        # 获取消息数量
        message_count = conn.execute(
            "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchone()["count"]

        conn.close()

        # 通知新成员
        await manager.send_to_user(
            company_name,
            member_data.username,
            {
                "type": "added_to_conversation",
                "conversation": {
                    "conversation_id": conversation_id,
                    "title": conv_info["title"],
                    "announcement": conv_info["announcement"],
                    "members": member_list,
                    "message_count": message_count,
                    "unread_count": message_count  # 新成员的消息全部视为未读
                }
            }
        )

        # 通知对话中的现有成员（不包括新成员）成员列表已更新
        existing_members = [m for m in member_list if m != member_data.username]
        await manager.broadcast_to_conversation(
            conversation_id,
            company_name,
            {
                "type": "conversation_members_updated",
                "conversation_id": conversation_id,
                "members": member_list
            },
            existing_members
        )

        return {"message": f"用户 '{member_data.username}' 已添加到对话"}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{conversation_id}/members/batch")
async def add_conversation_members_batch(
    conversation_id: str,
    members_data: ConversationMembersBatchAdd,
    auth: tuple = Depends(get_current_auth)
):
    """批量添加成员到对话"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        # 验证对话存在并属于该公司
        conv = conn.execute(
            "SELECT id, company_name FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()
        if not conv:
            conn.close()
            raise HTTPException(status_code=404, detail="对话不存在")

        if conv["company_name"] != company_name:
            conn.close()
            raise HTTPException(status_code=403, detail="无权访问此对话")

        # 验证当前用户在对话中
        verify_user_in_conversation(conn, conversation_id, company_name, username)

        # 批量验证所有用户（优化：单次查询替代循环查询）
        valid_members = []
        already_in_conversation = []
        not_found = []

        if members_data.usernames:
            # 批量查询用户是否存在
            placeholders = ",".join(["?" for _ in members_data.usernames])
            valid_users = conn.execute(
                f"SELECT username FROM users WHERE company_name = ? AND username IN ({placeholders})",
                (company_name, *members_data.usernames)
            ).fetchall()
            valid_usernames = {u["username"] for u in valid_users}

            # 批量查询已存在的对话成员
            existing_members = conn.execute(
                f"SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username IN ({placeholders})",
                (conversation_id, company_name, *members_data.usernames)
            ).fetchall()
            existing_usernames = {e["username"] for e in existing_members}

            # 分类用户
            for member_username in members_data.usernames:
                if member_username not in valid_usernames:
                    not_found.append(member_username)
                elif member_username in existing_usernames:
                    already_in_conversation.append(member_username)
                else:
                    valid_members.append(member_username)

        # 批量添加有效成员（优化：单次批量插入替代循环插入）
        added_members = []
        if valid_members:
            member_records = [(conversation_id, company_name, member) for member in valid_members]
            conn.executemany(
                "INSERT INTO conversation_members (conversation_id, company_name, username) VALUES (?, ?, ?)",
                member_records
            )
            added_members = valid_members

        conn.commit()

        # 获取对话信息（用于通知新成员）
        conv_info = conn.execute(
            "SELECT title, announcement FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()

        # 获取所有成员（包括新添加的成员）
        members = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchall()
        member_list = [m["username"] for m in members]

        # 获取消息数量
        message_count = conn.execute(
            "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchone()["count"]

        conn.close()

        # 通知所有新成员
        for member_username in added_members:
            await manager.send_to_user(
                company_name,
                member_username,
                {
                    "type": "added_to_conversation",
                    "conversation": {
                        "conversation_id": conversation_id,
                        "title": conv_info["title"],
                        "announcement": conv_info["announcement"],
                        "members": member_list,
                        "message_count": message_count,
                        "unread_count": message_count  # 新成员的消息全部视为未读
                    }
                }
            )

        # 通知对话中的现有成员（不包括新成员）成员列表已更新
        existing_members = [m for m in member_list if m not in added_members]
        await manager.broadcast_to_conversation(
            conversation_id,
            company_name,
            {
                "type": "conversation_members_updated",
                "conversation_id": conversation_id,
                "members": member_list
            },
            existing_members
        )

        return {
            "message": f"已添加 {len(added_members)} 个成员",
            "added": added_members,
            "already_in_conversation": already_in_conversation,
            "not_found": not_found
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{conversation_id}/members/{username}")
async def remove_conversation_member(
    conversation_id: str,
    username: str,
    auth: tuple = Depends(get_current_auth)
):
    """从对话中移除成员"""
    company_name, current_username = auth

    if not current_username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        # 验证对话存在并属于该公司
        conv = conn.execute(
            "SELECT id, company_name FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()
        if not conv:
            conn.close()
            raise HTTPException(status_code=404, detail="对话不存在")

        if conv["company_name"] != company_name:
            conn.close()
            raise HTTPException(status_code=403, detail="无权访问此对话")

        # 验证当前用户在对话中
        verify_user_in_conversation(conn, conversation_id, company_name, current_username)

        # 验证要移除的用户在对话中
        member = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username = ?",
            (conversation_id, company_name, username)
        ).fetchone()
        if not member:
            conn.close()
            raise HTTPException(status_code=400, detail="用户不在此对话中")

        # 检查删除后对话成员数，确保至少剩2个成员
        member_count = conn.execute(
            "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchone()["count"]
        if member_count <= 2:
            conn.close()
            raise HTTPException(status_code=400, detail="对话成员数不能少于2人")

        # 移除成员
        conn.execute(
            "DELETE FROM conversation_members WHERE conversation_id = ? AND company_name = ? AND username = ?",
            (conversation_id, company_name, username)
        )
        conn.commit()
        conn.close()

        return {"message": f"用户 '{username}' 已从对话中移除"}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{conversation_id}/attachments")
async def get_conversation_attachments(
    conversation_id: str,
    auth: tuple = Depends(get_current_auth)
):
    """获取指定对话的所有附件列表"""
    company_name, username = auth

    if not username:
        raise HTTPException(status_code=401, detail="未认证")

    conn = get_db_connection()

    try:
        # 验证对话存在并属于该公司
        conv = conn.execute(
            "SELECT id, company_name FROM conversations WHERE id = ?",
            (conversation_id,)
        ).fetchone()
        if not conv:
            conn.close()
            raise HTTPException(status_code=404, detail="对话不存在")

        if conv["company_name"] != company_name:
            conn.close()
            raise HTTPException(status_code=403, detail="无权访问此对话")

        # 验证当前用户在对话中
        verify_user_in_conversation(conn, conversation_id, company_name, username)

        # 获取该对话所有消息关联的附件（去重），并包含消息ID
        attachments = conn.execute("""
            SELECT DISTINCT
                a.id,
                a.filename,
                a.mime_type,
                datetime(a.uploaded_at) || 'Z' as uploaded_at,
                a.uploaded_by,
                ma.message_id
            FROM attachments a
            INNER JOIN message_attachments ma ON a.id = ma.attachment_id
            INNER JOIN messages m ON ma.message_id = m.id AND a.company_name = m.company_name
            WHERE m.conversation_id = ? AND m.company_name = ?
            ORDER BY a.uploaded_at DESC
        """, (conversation_id, company_name)).fetchall()

        result = []
        for att in attachments:
            result.append({
                "attachment_id": att["id"],
                "filename": att["filename"],
                "mime_type": att["mime_type"],
                "uploaded_at": att["uploaded_at"],
                "uploaded_by": att["uploaded_by"],
                "message_id": att["message_id"]
            })

        conn.close()
        return {"attachments": result}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
