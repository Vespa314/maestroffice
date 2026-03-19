import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from models import MessageCreate
from database import get_db_connection, verify_user_in_conversation, verify_user_in_conversation_strict
from urllib.parse import unquote
from .websocket import manager

router = APIRouter(prefix="/conversations", tags=["消息"])


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


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    history_count: int = Query(0, description="除了未读消息外，再往前拉取多少条历史消息", ge=0),
    update_read_position: bool = Query(True, description="是否更新用户的读取位置"),
    auth: tuple = Depends(get_current_auth)
):
    """获取对话消息，优先返回未读消息"""
    company_name, username = auth

    conn = get_db_connection()

    # 验证对话存在并获取对话信息
    conv = conn.execute(
        "SELECT id, company_name, title, announcement FROM conversations WHERE id = ?",
        (conversation_id,)
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="对话不存在")

    # 验证对话属于该公司
    if conv["company_name"] != company_name:
        conn.close()
        raise HTTPException(status_code=403, detail="无权访问此对话")

    conversation_info = {
        "conversation_id": conv["id"],
        "title": conv["title"],
        "announcement": conv["announcement"]
    }

    # 验证用户在对话中
    verify_user_in_conversation(conn, conversation_id, company_name, username)

    # 获取用户在该对话中的最后读取位置
    read_record = conn.execute("""
        SELECT last_read_message_id
        FROM user_conversation_reads
        WHERE company_name = ? AND username = ? AND conversation_id = ?
    """, (company_name, username, conversation_id)).fetchone()

    last_read_message_id = read_record["last_read_message_id"] if read_record else None

    # 获取所有消息并按时间排序
    all_messages = conn.execute("""
        SELECT id, sender, content, datetime(created_at) || 'Z' as created_at
        FROM messages
        WHERE conversation_id = ? AND company_name = ?
        ORDER BY created_at ASC
    """, (conversation_id, company_name)).fetchall()

    if not all_messages:
        conn.close()
        return {
            "conversation": conversation_info,
            "messages": []
        }

    # 批量获取所有消息的附件（一次查询，包含文件名）
    message_ids = [msg["id"] for msg in all_messages]
    message_id_list = ",".join(["?" for _ in message_ids])
    attachments_rows = conn.execute(f"""
        SELECT ma.message_id, ma.attachment_id, a.filename, a.mime_type
        FROM message_attachments ma
        JOIN attachments a ON ma.attachment_id = a.id
        WHERE ma.message_id IN ({message_id_list})
    """, message_ids).fetchall()

    # 构建附件字典：message_id -> [attachment详情]
    attachments_dict = {}
    for row in attachments_rows:
        if row["message_id"] not in attachments_dict:
            attachments_dict[row["message_id"]] = []
        attachments_dict[row["message_id"]].append({
            "attachment_id": row["attachment_id"],
            "filename": row["filename"],
            "mime_type": row["mime_type"]
        })

    # 分割未读和历史消息并组装结果
    result = []
    unread_messages = []
    history_messages = []

    found_last_read = False

    for msg in all_messages:
        message_data = {
            "message_id": msg["id"],
            "sender": msg["sender"],
            "content": msg["content"],
            "attachments": attachments_dict.get(msg["id"], []),
            "created_at": msg["created_at"],
            "read": True  # 默认已读
        }

        if not found_last_read:
            if last_read_message_id is None or msg["id"] == last_read_message_id:
                # 找到了最后读取的消息
                found_last_read = True
                message_data["read"] = True
                history_messages.append(message_data)
            else:
                # 还没找到最后读取的消息，这些都是已读的历史消息
                message_data["read"] = True
                history_messages.append(message_data)
        else:
            # 已经找到了最后读取的消息，之后的消息都是未读的
            message_data["read"] = False
            unread_messages.append(message_data)

    # 限制历史消息数量
    if history_count > 0:
        history_messages = history_messages[-history_count:]

    # 合并消息：历史消息 + 未读消息
    result = history_messages + unread_messages

    # 更新用户的读取位置到最后一条消息（可选）
    if update_read_position and all_messages:
        last_message_id = all_messages[-1]["id"]
        conn.execute("""
            INSERT INTO user_conversation_reads (company_name, username, conversation_id, last_read_message_id, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(company_name, username, conversation_id) DO UPDATE SET
                last_read_message_id = excluded.last_read_message_id,
                updated_at = CURRENT_TIMESTAMP
        """, (company_name, username, conversation_id, last_message_id))
        conn.commit()

    conn.close()
    return {
        "conversation": conversation_info,
        "total_count": len(all_messages),
        "unread_count": len(unread_messages),
        "messages": result
    }


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    message: MessageCreate,
    auth: tuple = Depends(get_current_auth)
):
    """在对话中发送消息"""
    company_name, username = auth

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

        # 严格验证当前用户在对话中（即使是MASTER_STAFF也必须在对话中才能发送消息）
        verify_user_in_conversation_strict(conn, conversation_id, company_name, username)

        # 验证消息内容不为空
        if not message.content or not message.content.strip():
            conn.close()
            raise HTTPException(status_code=400, detail="消息内容不能为空")

        # 批量验证附件存在且属于该公司（优化：单次查询替代循环查询）
        if message.attachment_ids:
            placeholders = ",".join(["?" for _ in message.attachment_ids])
            valid_attachments = conn.execute(
                f"SELECT id FROM attachments WHERE id IN ({placeholders}) AND company_name = ?",
                (*message.attachment_ids, company_name)
            ).fetchall()
            valid_attachment_ids = {att["id"] for att in valid_attachments}

            # 检查是否有不存在的附件
            invalid_attachments = [aid for aid in message.attachment_ids if aid not in valid_attachment_ids]
            if invalid_attachments:
                conn.close()
                raise HTTPException(status_code=400, detail=f"以下附件不存在: {', '.join(invalid_attachments)}")

        # 创建消息
        message_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO messages (id, conversation_id, company_name, sender, content) VALUES (?, ?, ?, ?, ?)",
            (message_id, conversation_id, company_name, username, message.content)
        )

        # 批量添加附件关联（优化：单次批量插入替代循环插入）
        if message.attachment_ids:
            attachment_records = [(message_id, aid) for aid in message.attachment_ids]
            conn.executemany(
                "INSERT INTO message_attachments (message_id, attachment_id) VALUES (?, ?)",
                attachment_records
            )

        conn.commit()

        # 如果倒数第二条消息已读（或者是第一条消息），则将刚发送的消息也标记为已读
        second_last_msg = conn.execute("""
            SELECT id
            FROM messages
            WHERE conversation_id = ? AND company_name = ?
            ORDER BY created_at DESC
            LIMIT 1 OFFSET 1
        """, (conversation_id, company_name)).fetchone()

        # 检查是否应该标记为已读
        should_mark_as_read = False

        if second_last_msg:
            # 有倒数第二条消息，检查是否已读
            read_record = conn.execute("""
                SELECT last_read_message_id
                FROM user_conversation_reads
                WHERE company_name = ? AND username = ? AND conversation_id = ?
            """, (company_name, username, conversation_id)).fetchone()

            if read_record and read_record["last_read_message_id"] == second_last_msg["id"]:
                # 倒数第二条消息已读
                should_mark_as_read = True
        else:
            # 没有倒数第二条消息，说明这是第一条消息，直接标记为已读
            should_mark_as_read = True

        if should_mark_as_read:
            conn.execute("""
                INSERT INTO user_conversation_reads (company_name, username, conversation_id, last_read_message_id, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(company_name, username, conversation_id) DO UPDATE SET
                    last_read_message_id = excluded.last_read_message_id,
                    updated_at = CURRENT_TIMESTAMP
            """, (company_name, username, conversation_id, message_id))
            conn.commit()

        # 获取对话成员列表，用于广播
        members = conn.execute(
            "SELECT username FROM conversation_members WHERE conversation_id = ? AND company_name = ?",
            (conversation_id, company_name)
        ).fetchall()
        member_list = [m["username"] for m in members]

        # 获取额外接收者（MASTER_STAFF/管理员）
        from database import MASTER_STAFF
        additional_recipients = []
        # 检查MASTER_STAFF是否在线且不在对话成员中
        master_staff_key = (company_name, MASTER_STAFF)
        if master_staff_key in manager.active_connections and MASTER_STAFF not in member_list:
            additional_recipients.append(MASTER_STAFF)

        # 获取完整消息数据
        message_data = conn.execute("""
            SELECT id, sender, content, datetime(created_at) || 'Z' as created_at
            FROM messages WHERE id = ?
        """, (message_id,)).fetchone()

        # 获取消息的附件信息
        attachments = conn.execute("""
            SELECT ma.attachment_id, a.filename, a.mime_type
            FROM message_attachments ma
            JOIN attachments a ON ma.attachment_id = a.id
            WHERE ma.message_id = ?
        """, (message_id,)).fetchall()

        attachment_list = [
            {"attachment_id": att["attachment_id"], "filename": att["filename"], "mime_type": att["mime_type"]}
            for att in attachments
        ]

        conn.close()

        # 生成消息预览内容
        preview_content = message_data["content"] if message_data["content"] else ""
        if attachment_list:
            if len(attachment_list) == 1:
                att = attachment_list[0]
                if att["mime_type"].startswith("image/"):
                    preview_content = "[图片]"
                elif att["mime_type"].startswith("video/"):
                    preview_content = "[视频]"
                elif att["mime_type"].startswith("audio/"):
                    preview_content = "[音频]"
                else:
                    preview_content = f"[文件] {att['filename']}"
            else:
                preview_content = f"[{len(attachment_list)}个文件]"

        # 截断文本消息（前100个字符）
        if preview_content and not preview_content.startswith("["):
            if len(preview_content) > 100:
                preview_content = preview_content[:100] + "..."

        # 广播新消息给对话的所有成员 + MASTER_STAFF（如果在线）
        await manager.broadcast_to_conversation(
            conversation_id,
            company_name,
            {
                "type": "new_message",
                "conversation_id": conversation_id,
                "message": {
                    "message_id": message_data["id"],
                    "sender": message_data["sender"],
                    "content": message_data["content"],
                    "created_at": message_data["created_at"],
                    "attachments": attachment_list
                },
                "last_message_preview": {
                    "message_id": message_data["id"],
                    "sender": message_data["sender"],
                    "content": preview_content
                }
            },
            member_list,
            additional_recipients
        )

        return {"message_id": message_id}

    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
