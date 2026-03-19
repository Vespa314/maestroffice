import os
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/heartbeat", tags=["心跳检测"])

# PID 文件路径
PID_FILE = Path(__file__).parent.parent.parent / "pid" / "ai_company_trigger.pid"
# 停止标识文件路径
STOP_FLAG_FILE = Path(__file__).parent.parent.parent / "pid" / "ai_company_trigger.stop"
# 失败角色记录目录
FAILED_ROLES_DIR = Path(__file__).parent.parent.parent / "failed_roles"
# 失败超时时间（与 ai_company_trigger.py 保持一致）
FAILURE_TIMEOUT = 3600


def read_pid() -> int | None:
    """读取 PID 文件"""
    if not PID_FILE.exists():
        return None

    try:
        with open(PID_FILE, "r") as f:
            return int(f.read().strip())
    except (ValueError, IOError):
        return None


def is_process_alive(pid: int) -> bool:
    """检查进程是否存在"""
    try:
        # 发送信号 0 检测进程是否存在
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def has_recent_failures() -> bool:
    """检查是否有任何最近的失败记录（与 ai_company_trigger.py 逻辑一致）"""
    if not FAILED_ROLES_DIR.exists():
        return False

    current_time = int(time.time())

    # 遍历所有失败记录文件
    for filename in FAILED_ROLES_DIR.glob("*.txt"):
        try:
            with open(filename, "r") as f:
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


@router.get("/check")
async def check_heartbeat():
    """检查调度进程是否存在且未被停止"""
    pid = read_pid()

    if pid is None:
        return {"alive": False, "pid": None, "message": "进程未运行过", "has_recent_failures": False}

    # 进程存在且停止标识文件不存在才认为是存活
    process_alive = is_process_alive(pid)
    stop_flag_exists = STOP_FLAG_FILE.exists()
    alive = process_alive and not stop_flag_exists

    # 检查是否有最近的失败记录
    recent_failures = has_recent_failures()

    if not process_alive:
        message = "进程未运行"
    elif stop_flag_exists:
        message = "进程已停止"
    elif recent_failures:
        message = "进程有失败记录"
    else:
        message = "进程运行中"

    return {
        "alive": alive,
        "pid": pid if process_alive else None,
        "message": message,
        "has_recent_failures": recent_failures
    }


@router.post("/kill")
async def kill_heartbeat():
    """停止调度进程（通过创建停止标识文件）"""
    pid = read_pid()

    if pid is None:
        raise HTTPException(status_code=404, detail="心跳进程可能未启动")

    if not is_process_alive(pid):
        raise HTTPException(status_code=404, detail="心跳进程未运行")

    try:
        # 创建停止标识文件
        STOP_FLAG_FILE.parent.mkdir(parents=True, exist_ok=True)
        STOP_FLAG_FILE.touch()

        return {"message": f"已发送停止指令 (PID: {pid})"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建停止标识文件失败: {str(e)}")


@router.post("/resume")
async def resume_heartbeat():
    """恢复调度进程（通过删除停止标识文件）"""
    pid = read_pid()

    if pid is None:
        raise HTTPException(status_code=404, detail="心跳进程可能未启动")

    if not is_process_alive(pid):
        raise HTTPException(status_code=404, detail="心跳进程未运行，无法恢复")

    try:
        # 删除停止标识文件
        if STOP_FLAG_FILE.exists():
            STOP_FLAG_FILE.unlink()

        return {"message": f"已发送恢复指令 (PID: {pid})"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除停止标识文件失败: {str(e)}")
