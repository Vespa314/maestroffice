---
name: 办公通信软件
description: "使用办公通信软件实现创建对话，获取对话列表，获取对话消息，发送消息，上传/下载附件等功能，更新对话的公告信息"
---


## 对话管理

### `create_conversation.py`

**作用**: 创建一个新的对话，返回对话id

**参数**:
- `title` - 对话标题（必需），不可以为空
- `members...` - 所有需要参与对话的成员列表，可多个（必需）

**用法**:
```bash
python3 .claude/skills/办公/scripts/create_conversation.py <title> <member1> <member2> ...

# 示例
python3 .claude/skills/办公/scripts/create_conversation.py "项目讨论" alice bob charlie
```

**说明**:
- 成员列表中只需填写其他用户，无需包含自己

---

### `get_conversations.py`

**作用**: 获取当前用户参与的所有对话（包括标题，公告，成员列表，创建时间，未读消息数量）

**参数**:
- `--unread-only` - 只返回有未读消息的对话（可选）

**用法**:
```bash
# 获取所有对话
python3 .claude/skills/办公/scripts/get_conversations.py

# 只获取有未读消息的对话
python3 .claude/skills/办公/scripts/get_conversations.py --unread-only
```

**返回示例**:
```json
{
  "conversations": [
    {
      "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "项目讨论",
      "announcement": "请大家按时提交周报",
      "members": ["alice", "bob", "charlie"],
      "message_count": 25,
      "unread_count": 3,
    }
  ]
}
```

**字段说明**:
- `conversation_id` - 对话ID
- `title` - 对话标题
- `announcement` - 对话公告（可能为null）
- `members` - 对话成员列表（数组）
- `message_count` - 对话中消息总数
- `unread_count` - 你作为当前用户未读消息数量

### `update_announcement.py`

**作用**: 更新对话公告

**参数**:
- `conversation_id` - 对话ID（必需）
- `announcement_text` - 公告内容（必需），设置为空字符串可清除公告

**用法**:
```bash
python3 .claude/skills/办公/scripts/update_announcement.py <conversation_id> <announcement_text>

# 示例 - 设置公告
python3 .claude/skills/办公/scripts/update_announcement.py "550e8400-e29b" "请大家按时提交周报"

# 示例 - 清除公告
python3 .claude/skills/办公/scripts/update_announcement.py "550e8400-e29b" ""
```

---

---

## 消息管理

### `get_messages.py`

**作用**: 获取对话中的消息，优先返回未读消息

**参数**:
- `conversation_id` - 对话ID（必需）
- `history_count` - 除了未读消息外，再往前拉取多少条历史消息（可选），默认3

**用法**:
```bash
python3 .claude/skills/办公/scripts/get_messages.py <conversation_id> [history_count]
```

**说明**:
- 消息按时间顺序排列
- 每条消息包含 `read` 字段，表示当前用户是否已读
- 默认只返回未读消息（history_count=0）
- 设置 history_count 可以获取额外的历史消息，帮助理解对话上下文

**返回示例**:
```json
{
  "conversation": {
    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "项目讨论",
    "announcement": "请大家按时提交周报"
  },
  "total_count": 25,
  "unread_count": 3,
  "messages": [
    {
      "message_id": "msg001",
      "sender": "alice",
      "content": "大家好，项目进度如何？",
      "attachments": [],
      "created_at": "2025-01-15 10:30:00Z",
      "read": true
    },
    {
      "message_id": "msg002",
      "sender": "bob",
      "content": "看看这个文档",
      "attachments": [
        {
          "attachment_id": "att123",
          "filename": "报告.md"
        }
      ],
      "created_at": "2025-01-15 10:35:00Z",
      "read": false
    }
  ]
}
```

**字段说明**:

**顶层字段**:
- `conversation` - 对话基本信息
  - `conversation_id` - 对话ID
  - `title` - 对话标题
  - `announcement` - 对话公告
- `total_count` - 对话中消息总数
- `unread_count` - 未读消息数量
- `messages` - 消息列表（数组）

**消息字段**:
- `message_id` - 消息ID
- `sender` - 发送者用户名
- `content` - 消息内容
- `attachments` - 附件列表（数组），每个附件包含：
  - `attachment_id` - 附件ID
  - `filename` - 文件名
- `read` - 你作为当前用户之前是否已读（true/false）

---

### `send_message.py`

**作用**: 在对话中发送消息

**参数**:
- `conversation_id` - 对话ID（必需）
- `--content` - 消息内容（必需）
- `--attach` - 已存在的附件ID列表，逗号分隔（可选）
- `--files` - 需要上传作为附件的本地文件路径列表，用空格分隔（可选）

注意：

**用法**:
```bash
# 纯文本消息
python3 .claude/skills/办公/scripts/send_message.py <conv_id> --content "看看这个"

# 使用已有的附件ID
python3 .claude/skills/办公/scripts/send_message.py <conv_id> --content "看看这些文件" --attach 123-456,789-012

# 多个文件用空格分隔
python3 .claude/skills/办公/scripts/send_message.py <conv_id> --content "图片和文档" --files ./image.png ./doc.pdf

# 混合使用本地文件和已有附件ID
python3 .claude/skills/办公/scripts/send_message.py <conv_id> --content "资料如下" --files ./new.pdf --attach att123
```

**说明**:
- --attach和--files 都可以实现发消息携带附件，亦可同时使用；使用--files时，文件会自动上传附件，无需手动操作
- `--files` 的多个路径用**空格**分隔，`--attach` 的多个ID用**逗号**分隔
- 可以同时使用 `--attach` 和 `--files` 参数

---

## 附件管理

### `upload_attachment.py`

**作用**: 上传文件作为附件，返回附件id

**参数**:
- `filepath` - 文件路径（必需，支持任意类型文件）

**用法**:
```bash
# 上传文本文件
python3 .claude/skills/办公/scripts/upload_attachment.py ./notes.md

# 上传其他类型文件（图片、PDF等）
python3 .claude/skills/办公/scripts/upload_attachment.py ./image.png
```

**注意事项**
附件id请在发消息时通过send_message的--attach参数发送，不要直接在对话中发送附件id

---

### `get_text_attachment.py`
**作用**: 查看文本附件内容

**注意**：
**非文本类型附件** (图片、视频、音频、PDF等)请不要用此工具获取，而是使用 `save_attachment.py` 下载文件

```bash
python3 .claude/skills/办公/scripts/get_text_attachment.py <attachment_id>
```


**字段说明**:
- `attachment_id` - 附件ID
- `filename` - 文件名
- `mime_type` - MIME类型
- `content` - 附件文本内容（仅文本类型）
- `uploaded_at` - 上传时间
- `uploaded_by` - 上传者

---

### `save_attachment.py`
**作用**: 下载附件到本地（适用于一切附件类型，包括文本文件）

**参数**:
- `attachment_id` - 附件ID（必需）
- `output_dir` - 输出目录路径（必需）

**用法**:
```bash
python3 .claude/skills/办公/scripts/save_attachment.py <attachment_id> <output_dir>

python3 .claude/skills/办公/scripts/save_attachment.py att456-789-012 ./images
```

**说明**:
- 文件会以原始文件名保存到指定目录
- 如果目录不存在，会自动创建
