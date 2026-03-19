from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List, Optional, Set
from urllib.parse import unquote

router = APIRouter(prefix="/ws", tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        # (company_name, username) -> Set of WebSocket connections
        self.active_connections: Dict[tuple, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, company_name: str, username: str):
        await websocket.accept()
        key = (company_name, username)
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)

    def disconnect(self, websocket: WebSocket, company_name: str, username: str):
        key = (company_name, username)
        if key in self.active_connections:
            self.active_connections[key].discard(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]

    async def broadcast_to_conversation(self, conversation_id: str, company_name: str, message: dict, members: List[str], additional_recipients: Optional[List[str]] = None):
        """向对话的所有成员广播消息

        Args:
            conversation_id: 对话ID
            company_name: 公司名
            message: 消息内容
            members: 对话成员列表
            additional_recipients: 额外的接收者列表（如MASTER_STAFF），即使不在对话中也能收到消息
        """
        # 合并接收者列表：对话成员 + 额外接收者
        all_recipients = set(members)
        if additional_recipients:
            all_recipients.update(additional_recipients)

        for recipient in all_recipients:
            key = (company_name, recipient)
            if key in self.active_connections:
                for conn in self.active_connections[key]:
                    try:
                        await conn.send_json(message)
                    except Exception:
                        # 连接可能已关闭，忽略错误
                        pass

    async def send_to_user(self, company_name: str, username: str, message: dict):
        """向特定用户发送消息

        Args:
            company_name: 公司名
            username: 用户名
            message: 消息内容
        """
        key = (company_name, username)
        if key in self.active_connections:
            for conn in self.active_connections[key]:
                try:
                    await conn.send_json(message)
                except Exception:
                    # 连接可能已关闭，忽略错误
                    pass

    async def broadcast_to_company(self, company_name: str, message: dict):
        """向公司的所有用户广播消息

        Args:
            company_name: 公司名
            message: 消息内容
        """
        # 遍历所有连接，找到属于该公司的所有用户
        for key in self.active_connections:
            if key[0] == company_name:
                for conn in self.active_connections[key]:
                    try:
                        await conn.send_json(message)
                    except Exception:
                        # 连接可能已关闭，忽略错误
                        pass


manager = ConnectionManager()


@router.websocket("/messages")
async def websocket_messages(
    websocket: WebSocket,
    auth: str = Query(..., description="认证信息，格式: company:username")
):
    """WebSocket 连接用于实时接收新消息"""
    # 解码 URL 编码的认证信息
    auth = unquote(auth)
    parts = auth.split(":", 1)
    if len(parts) != 2:
        await websocket.close(code=1008, reason="认证信息格式错误")
        return

    company_name, username = parts
    await manager.connect(websocket, company_name, username)

    try:
        while True:
            # 保持连接，接收心跳
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, company_name, username)
