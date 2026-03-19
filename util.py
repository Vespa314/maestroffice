import os
from pathlib import Path

import yaml

cur_path = os.path.dirname(os.path.abspath(__file__))
g_config = None


def get_g_config():
    global g_config
    if g_config is not None:
        return g_config
    config_path = f"{cur_path}/config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        g_config = yaml.safe_load(f)
    return g_config



def get_config(key: str, default=None):
    """从 config.yaml 读取配置项

    Args:
        key: 配置项的键名
        default: 默认值（如果配置项不存在或读取失败）

    Returns:
        配置项的值，如果不存在则返回默认值
    """
    return get_g_config().get(key, default)


def get_staff_dir():
    """获取员工目录路径

    Returns:
        Path: 员工目录的完整路径（Path对象）
    """
    staff_dir_config = get_config("staff_dir", None)
    assert staff_dir_config is not None

    return Path(staff_dir_config)
