import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime
from urllib.parse import quote

import requests

from util import get_config, get_staff_dir

cur_path = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(cur_path, 'backend')
sys.path.insert(0, backend_path)

API_BASE_URL = "http://127.0.0.1:18520"


def get_user_claude_session_info(company_name: str, username: str) -> tuple[str | None, int]:
    """获取用户的 Claude session 信息

    Args:
        company_name: 公司名称
        username: 用户名

    Returns:
        tuple[str | None, int]: (session_id, conversation_count)
        - session_id: 最后一次的 session_id，如果不存在返回 None
        - conversation_count: 历史对话轮数
    """
    try:
        auth_value = quote(f"{company_name}:{username}")
        api_url = f"{API_BASE_URL}/api/timeline/claude-session-info"
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Auth': auth_value
        }

        response = requests.get(
            api_url,
            headers=headers,
            timeout=5
        )

        if response.status_code == 200:
            data = response.json()
            session_id = data.get("session_id")
            conversation_count = data.get("conversation_count", 0)
            return (session_id, conversation_count)
        else:
            print(f"[{datetime.now().isoformat()}] 获取 session 信息失败: {response.status_code} - {response.text}")
            return (None, 0)

    except requests.exceptions.Timeout:
        print(f"[{datetime.now().isoformat()}] 获取 session 信息超时")
        return (None, 0)
    except requests.exceptions.RequestException as api_error:
        print(f"[{datetime.now().isoformat()}] 获取 session 信息请求失败: {api_error}")
        return (None, 0)
    except Exception as e:
        print(traceback.format_exc())
        print(f"[{datetime.now().isoformat()}] 获取 session 信息发生错误: {e}")
        return (None, 0)


def report_timeline(company_name: str, username: str, output: str, duration: float | None = None, start_time: str | None = None, end_time: str | None = None) -> bool:
    """上报 timeline 记录到后端 API

    Args:
        company_name: 公司名称
        username: 用户名
        output: 执行输出的内容
        duration: 运行时长（秒）
        start_time: 开始时间（ISO格式）
        end_time: 结束时间（ISO格式）

    Returns:
        bool: 上报是否成功
    """
    try:
        # 对中文进行 URL 编码
        auth_value = quote(f"{company_name}:{username}")
        api_url = f"{API_BASE_URL}/api/timeline"
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Auth': auth_value
        }
        data = {
            "output": output,
            "duration": duration,
            "start_time": start_time,
            "end_time": end_time
        }

        response = requests.post(
            api_url,
            data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
            headers=headers,
            timeout=5
        )

        if response.status_code == 200:
            return True
        else:
            print(f"[{datetime.now().isoformat()}] Timeline 上报失败: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.Timeout:
        print(f"[{datetime.now().isoformat()}] Timeline 上报超时")
        return False
    except requests.exceptions.RequestException as api_error:
        print(f"[{datetime.now().isoformat()}] Timeline 上报请求失败: {api_error}")
        return False
    except Exception as e:
        print(traceback.format_exc())
        print(f"[{datetime.now().isoformat()}] Timeline 上报发生错误: {e}")
        return False


def report_working_status(company_name: str, username: str, is_working: bool) -> bool:
    """上报工作状态到后端 API

    Args:
        company_name: 公司名称
        username: 用户名
        is_working: 是否在工作

    Returns:
        bool: 上报是否成功
    """
    try:
        # 对中文进行 URL 编码
        auth_value = quote(f"{company_name}:{username}")
        api_url = f"{API_BASE_URL}/api/users/working-status"
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Auth': auth_value
        }
        data = {"is_working": is_working}

        response = requests.patch(
            api_url,
            data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
            headers=headers,
            timeout=5
        )

        if response.status_code == 200:
            return True
        else:
            print(f"[{datetime.now().isoformat()}] 工作状态上报失败: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.Timeout:
        print(f"[{datetime.now().isoformat()}] 工作状态上报超时")
        return False
    except requests.exceptions.RequestException as api_error:
        print(f"[{datetime.now().isoformat()}] 工作状态上报请求失败: {api_error}")
        return False
    except Exception as e:
        print(traceback.format_exc())
        print(f"[{datetime.now().isoformat()}] 工作状态上报发生错误: {e}")
        return False


def get_company_users(company_name: str, current_username: str) -> list:
    """获取公司所有用户列表（除当前用户外）

    Args:
        company_name: 公司名称
        current_username: 当前用户名

    Returns:
        list: 其他用户名列表
    """
    try:
        # 对中文进行 URL 编码
        auth_value = quote(f"{company_name}:{current_username}")
        # 使用与 get_users.py 相同的接口：/api/users
        api_url = f"{API_BASE_URL}/api/users"
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Auth': auth_value
        }
        # 设置 full_detail=False，只返回用户名列表
        params = {"full_detail": False}

        response = requests.get(
            api_url,
            headers=headers,
            params=params,
            timeout=5
        )

        if response.status_code == 200:
            users_data = response.json()
            # API 返回格式：[{"username": "用户1"}, {"username": "用户2"}, ...]
            # 提取用户名并过滤掉当前用户
            other_usernames = [
                user['username'] for user in users_data
                if user['username'] != current_username
            ]
            return other_usernames
        else:
            print(f"[{datetime.now().isoformat()}] 获取公司用户列表失败: {response.status_code} - {response.text}")
            return []

    except requests.exceptions.Timeout:
        print(f"[{datetime.now().isoformat()}] 获取公司用户列表超时")
        return []
    except requests.exceptions.RequestException as api_error:
        print(f"[{datetime.now().isoformat()}] 获取公司用户列表请求失败: {api_error}")
        return []
    except Exception as e:
        print(traceback.format_exc())
        print(f"[{datetime.now().isoformat()}] 获取公司用户列表发生错误: {e}")
        return []


def compact_dialog(path, session_id):
    command = f"""claude --dangerously-skip-permissions --print -r "{session_id}" '/compact'"""
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        check=True,
        stdin=subprocess.DEVNULL,
        cwd=path
    )
    print("压缩对话完成:", result.stdout)


def run_claude(company_name: str, username, prompt: str, ):
    def format_prompt(prompt: str):
        return prompt.replace("\\n", "<br/>").replace("'", '"').replace(" ", '')

    staff_path = get_staff_dir() / company_name / username

    command = f"""claude --dangerously-skip-permissions --print --verbose --output-format json '{format_prompt(prompt)}'"""

    # 只有在配置为 true 时才尝试获取 session_id
    if get_config('resume_session_id', True):
        session_id, conversation_count = get_user_claude_session_info(company_name, username)
        # 如果存在 session_id，添加 -r 参数
        if session_id:
            compact_round = get_config('compact_round', 0)
            compact_round = int(compact_round) if compact_round else 0
            if compact_round != 0 and (conversation_count % compact_round) == 0:
                compact_dialog(staff_path, session_id)
            command = f"""claude --dangerously-skip-permissions --print --verbose --output-format json -r "{session_id}" '{format_prompt(prompt)}'"""

    # 上报开始工作状态（不影响主流程）
    try:
        report_working_status(company_name, username, True)
    except Exception as e:
        print(f"上报开始工作状态失败: {e}")

    try:
        begin_time = time.time()
        start_time_iso = datetime.now().isoformat()
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            check=True,
            stdin=subprocess.DEVNULL,
            cwd=staff_path
        )
        end_time_iso = datetime.now().isoformat()
        duration = time.time() - begin_time

        try:
            response = json.loads(result.stdout)
            print(response[-1]['result'])
        except Exception as e:
            print(f"解析结果失败: {e}")
            print(traceback.format_exc())


        if result.stderr:
            print("标准错误:")
            print(result.stderr)

        # 上报 timeline（不影响主流程）
        try:
            report_timeline(company_name, username, result.stdout, duration, start_time_iso, end_time_iso)
        except Exception as e:
            print(f"上报 timeline 失败: {e}")

        return result.stdout

    except subprocess.CalledProcessError as e:
        error_msg = f"命令执行失败，返回码: {e.returncode}\n错误输出:\n{e.stderr}"
        print(error_msg)
        raise RuntimeError(error_msg) from e

    finally:
        # 上报结束工作状态（不影响主流程）

        try:
            report_working_status(company_name, username, False)
        except Exception as e:
            print(f"上报结束工作状态失败: {e}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 run_single_role.py <company_name> <username>")
        sys.exit(1)

    company_name = sys.argv[1]
    username = sys.argv[2]

    pid_file = f'{cur_path}/pid/{company_name}_{username}'
    pid_dir = os.path.dirname(pid_file)
    os.makedirs(pid_dir, exist_ok=True)

    if os.path.exists(pid_file):
        with open(pid_file, 'r') as f:
            old_pid = int(f.read().strip())
        try:
            # 发送信号0检测进程是否存在
            os.kill(old_pid, 0)
            print(f'{company_name}:{username} 上一轮未完成(PID: {old_pid})，直接退出')
            sys.exit(0)
        except (ProcessLookupError, OSError):
            # 进程不存在，继续执行
            print(f'{company_name}:{username} 旧进程(PID: {old_pid})已停止，继续执行')

    with open(pid_file, 'w') as f:
        f.write(str(os.getpid()))
    try:
        # 获取公司其他人员信息
        other_users = get_company_users(company_name, username)
        other_users_str = ', '.join(other_users) if other_users else '无'

        soul_file = open(f"{cur_path}/Soul/{company_name}/{username}.md", "r", encoding="utf-8").read()

        # 读取公司soul文件（如果存在且非空）
        company_soul_content = ""
        company_soul_path = f"{cur_path}/Soul/{company_name}.md"
        try:
            if os.path.exists(company_soul_path):
                with open(company_soul_path, "r", encoding="utf-8") as f:
                    company_soul = f.read().strip()
                    if company_soul:  # 只在文件非空时添加
                        company_soul_content = f"""
---
以下是公司的统一守则：
{company_soul}
"""
        except Exception as e:
            print(f"读取公司soul文件失败: {e}")

        # 构建包含其他人员信息的 prompt
        prompt = f'''你在公司「{company_name}」里的身份是{username}（公司其他员工包括：{other_users_str}）；

请检查**所有未读消息**，然后读取Memory.md文件，然后根据你的【职责文件】的内容来做出恰当的处理；

## 关于Memory.md
Memory.md中记录了你之前的工作进展，这个文档需要**及时更新迭代**，里面记录内容包括但不限于：
- 当前需要关注的对话（简单描述这个对话的议题和进展）
- 你已完成的工作
- 你正在进行中的工作
    - 工作的待办事项拆解和进度（如果有的话）
- 犯过的错（防止以后再犯）
- 工作中一些需要你时刻谨记的关键信息

## 注意事项：
1. Memory.md只保留后续需要关注的信息，不用保留不再需要的内容。
2. 当前目录就是你的工作台，**你不可以读写当前目录以外的文件（比如父目录等）**，你只能增删改查当前目录下的文件。

如果你发现当前没有工作要做，那么什么都不需要做，直接退出。

---
以下是你的职责文件：
{soul_file}
{company_soul_content}
'''

        run_claude(company_name, username, prompt)
    finally:
        os.remove(pid_file)
