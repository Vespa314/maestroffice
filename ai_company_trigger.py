import os
import sqlite3
import subprocess
import threading
import time
import traceback
from urllib.parse import quote

import requests

from util import get_config

DATABASE_URL = "backend/company.db"
BACKEND_URL = "http://localhost:18520"
FAILED_ROLES_DIR = "failed_roles"  # 失败角色记录目录，每个用户一个文件
FAILURE_TIMEOUT = 3600  # 失败后1小时内跳过执行
STOP_FLAG_FILE = "pid/ai_company_trigger.stop"  # 停止标识文件


def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn


def get_role_failure_file(company_name: str, role: str) -> str:
    """获取指定角色的失败记录文件路径"""
    # 创建失败记录目录
    roles_dir = os.path.join(os.path.dirname(__file__), FAILED_ROLES_DIR)
    os.makedirs(roles_dir, exist_ok=True)

    # 返回该角色对应的文件路径
    filename = f"{company_name}_{role}.txt"
    return os.path.join(roles_dir, filename)


def mark_role_failed(company_name: str, role: str):
    """标记角色执行失败，记录时间戳"""
    failure_file = get_role_failure_file(company_name, role)
    with open(failure_file, "w") as f:
        f.write(f"{int(time.time())}\n")


def clear_role_failure(company_name: str, role: str):
    """清除指定角色的失败记录（执行成功时调用）"""
    failure_file = get_role_failure_file(company_name, role)
    if os.path.exists(failure_file):
        os.remove(failure_file)


def is_role_failed_recently(company_name: str, role: str) -> int:
    """检查角色是否在最近失败过（在超时时间内）"""
    failure_file = get_role_failure_file(company_name, role)

    if not os.path.exists(failure_file):
        return 0

    current_time = int(time.time())

    with open(failure_file, "r") as f:
        for line in f:
            try:
                timestamp = int(line.strip())
                # 如果失败记录在超时时间内，则跳过
                return 2 if current_time - timestamp < FAILURE_TIMEOUT else 1
            except ValueError:
                continue
    return 0


def has_recent_failures() -> bool:
    """检查是否有任何最近的失败记录"""
    roles_dir = os.path.join(os.path.dirname(__file__), FAILED_ROLES_DIR)

    if not os.path.exists(roles_dir):
        return False

    current_time = int(time.time())

    # 遍历所有失败记录文件
    for filename in os.listdir(roles_dir):
        if filename.endswith(".txt"):
            failure_file = os.path.join(roles_dir, filename)
            try:
                with open(failure_file, "r") as f:
                    for line in f:
                        try:
                            timestamp = int(line.strip())
                            if current_time - timestamp < FAILURE_TIMEOUT:
                                return True
                        except ValueError:
                            continue
            except Exception:
                continue

    return False


def get_users_with_unread_messages() -> set:
    """获取所有有未读消息的用户集合（格式：company_name:username）"""
    conn = get_db_connection()
    try:
        # 一次性查询所有用户的未读消息状态，包含公司名
        result = conn.execute("""
            SELECT DISTINCT cm.company_name, cm.username
            FROM messages m
            JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
            LEFT JOIN user_conversation_reads ucr ON
                cm.username = ucr.username AND
                cm.conversation_id = ucr.conversation_id
            WHERE (
                ucr.last_read_message_id IS NULL OR
                m.created_at > (
                    SELECT created_at
                    FROM messages
                    WHERE id = ucr.last_read_message_id
                )
            )
        """).fetchall()

        # 返回 company_name:username 格式的集合
        return {f'{row["company_name"]}:{row["username"]}' for row in result}
    finally:
        conn.close()


def check_backend_alive():
    """检查后端服务是否存活"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"后端连接失败: {e}")
        return False


def get_all_users():
    """获取所有公司的所有用户"""
    try:
        # 首先获取所有公司列表
        companies_response = requests.get(f"{BACKEND_URL}/api/users/companies", timeout=5)
        if companies_response.status_code != 200:
            print(f"获取公司列表失败: {companies_response.status_code}")
            return []

        companies = companies_response.json()
        all_users = []

        # 为每个公司获取用户列表
        for company in companies:
            company_name = company["name"]
            # 对 X-Auth header 进行 URL 编码以支持中文等非ASCII字符
            headers = {"X-Auth": quote(f"{company_name}:")}

            users_response = requests.get(f"{BACKEND_URL}/api/users", headers=headers, timeout=5)
            if users_response.status_code == 200:
                users = users_response.json()
                all_users.extend(users)

        return all_users
    except Exception as e:
        print(f"获取用户列表失败: {traceback.format_exc()}")
        return []


def get_on_duty_users():
    """获取所有在岗(is_on_duty)的用户"""
    users = get_all_users()
    return [user for user in users if user.get("is_on_duty", False)]


def watch_process(role: str, process: subprocess.Popen, log_file: str, company_name: str = ""):
    """监控进程执行状态，如果失败则记录"""
    try:
        begin_time = time.time()
        # 等待进程结束
        returncode = process.wait()

        # 写入结束信息到日志
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] 进程结束，返回码: {returncode}\n")
            f.write(f"{'↑'*60}\n")

        # 如果返回码不为0，记录失败
        if returncode != 0:
            prefix = f"[{company_name}:{role}]" if company_name else f"[{role}]"
            print(f"{prefix} 执行失败 (返回码: {returncode})")
            # push_gotify_v2('AI company fail', f'{role}执行失败，可能LLM没额度了')
            mark_role_failed(company_name, role)
        else:
            prefix = f"[{company_name}:{role}]" if company_name else f"[{role}]"
            print(f"{prefix} 执行完成, 耗时: {time.time() - begin_time:.2f}秒")
            # 执行成功，清除该角色的失败记录
            clear_role_failure(company_name, role)
    except Exception as e:
        prefix = f"[{company_name}:{role}]" if company_name else f"[{role}]"
        print(f"{prefix} 监控异常: {e}")
        mark_role_failed(company_name, role)


def run_role(user: dict, users_with_unread: set):
    """在后台启动单个角色进程（不等待完成）"""
    role = user["username"]
    company_name = user["company_name"]

    # 检查该角色是否在最近失败过，如果是则跳过
    fail_flag = False
    f = is_role_failed_recently(company_name, role)
    if f >= 1:
        if f == 2:
            print(f"[{company_name}:{role}] 最近失败过，跳过执行")
            return None
        else:
            fail_flag = True

    # 检查该角色是否有未读消息（从预查询的结果集中获取）
    has_unread = f"{company_name}:{role}" in users_with_unread
    if not has_unread:
        if not fail_flag:
            print(f"[{company_name}:{role}] 没有未读消息，跳过执行")
            return None
        else:
            print(f"[{company_name}:{role}] 没有未读消息，但是之前失败了，继续执行")

    script_path = os.path.join(os.path.dirname(__file__), "run_single_role.py")
    log_file = os.path.join(os.path.dirname(__file__), f"history/{company_name}_{role}.log")

    try:
        # 打开日志文件用于写入
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'↓'*60}\n")
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {company_name}:{role}：\n")

        # 使用 Popen 在后台启动进程，输出直接写入日志文件
        log_handle = open(log_file, "a", encoding="utf-8")
        process = subprocess.Popen(
            ["python3", script_path, company_name, role],
            stdout=log_handle,
            stderr=subprocess.STDOUT,  # 错误输出也写入同一文件
            stdin=subprocess.DEVNULL,
            start_new_session=True  # Linux/Mac: 创建新的进程组
        )

        print(f"[{company_name}:{role}] 进程已启动 (PID: {process.pid})")

        # 启动监控线程，等待进程结束并检查返回码
        watcher = threading.Thread(
            target=watch_process,
            args=(role, process, log_file, company_name),
            daemon=True
        )
        watcher.start()

        return process

    except Exception as e:
        print(f"[{company_name}:{role}] 启动失败: {e}")
        mark_role_failed(company_name, role)
        return None


def write_pid():
    """将当前进程的 PID 写入文件"""
    pid_dir = os.path.join(os.path.dirname(__file__), "pid")
    os.makedirs(pid_dir, exist_ok=True)
    pid_file = os.path.join(pid_dir, "ai_company_trigger.pid")

    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))

    print(f"PID 已写入: {pid_file} (PID: {os.getpid()})")


def cleanup_pid():
    """清理 PID 文件"""
    pid_file = os.path.join(os.path.dirname(__file__), "pid", "ai_company_trigger.pid")
    if os.path.exists(pid_file):
        os.remove(pid_file)


def main():
    """主循环：每隔1分钟运行所有角色"""
    print("-" * 50)

    # 初始检查后端和用户
    print("正在初始化...")
    if not check_backend_alive():
        print("错误: 后端服务未启动")
        return

    # 清除停止标识文件（如果存在）
    if os.path.exists(STOP_FLAG_FILE):
        os.remove(STOP_FLAG_FILE)
        print(f"已清除停止标识文件: {STOP_FLAG_FILE}")

    # 写入 PID 文件
    write_pid()

    # 创建 history 目录用于存储日志
    history_dir = os.path.join(os.path.dirname(__file__), "history")
    os.makedirs(history_dir, exist_ok=True)

    print("清空所有员工的工作状态...")
    try:
        clear_response = requests.post(f"{BACKEND_URL}/api/users/working-status/clear-all", timeout=5)
        if clear_response.status_code == 200:
            ...
        else:
            print(f"工作状态清空失败: {clear_response.status_code}")
    except Exception as e:
        print(f"工作状态清空请求失败: {e}")

    print("初始化完成，开始主循环...\n")

    no_process_count = 0
    nothing_happen_push_round = int(get_config("nothing_happen_push_round", 0))
    while True:
        # 检查停止标识文件，如果存在则只做sleep
        if os.path.exists(STOP_FLAG_FILE):
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 检测到停止标识，进入待机状态...")
            time.sleep(60)
            continue

        # 每次循环开始时检查后端存活状态
        if not check_backend_alive():
            print("警告: 后端服务不可用，等待重试...")
            time.sleep(60)
            continue

        if has_recent_failures():
            print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] 检测到执行失败，等待1小时后重试...")
            time.sleep(3600)
            continue

        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]")

        # 一次性查询所有有未读消息的用户
        users_with_unread = get_users_with_unread_messages()

        has_process = False
        for user in get_on_duty_users():
            role = user["username"]
            company_name = user["company_name"]
            print(f"\n正在处理角色: {company_name}:{role}")
            process = run_role(user, users_with_unread)
            if process:
                has_process = True

        if not has_process and nothing_happen_push_round > 0:
            no_process_count += 1
            if no_process_count >= nothing_happen_push_round:
                no_process_count = 0

        else:
            no_process_count = 0

        print("-" * 50)

        try:
            time.sleep(int(get_config("round_sleep", 60)))
        except KeyboardInterrupt:
            print("\n用户中断，退出程序")
            cleanup_pid()
            break


if __name__ == "__main__":
    main()
