import logging
import os
import traceback
from contextlib import asynccontextmanager
from datetime import datetime

from database import init_db
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from routes import (
    admin,
    attachments,
    conversations,
    heartbeat,
    messages,
    skills,
    soul,
    timeline,
    users,
    websocket,
    workspace,
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化数据库
    init_db()
    yield
    # 关闭时的清理工作（如需要）


app = FastAPI(title="Maestroffice", lifespan=lifespan)

# 添加 GZip 压缩中间件，仅压缩大于 1KB 的响应
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器，记录所有未捕获的异常"""
    logger.error(f"未捕获的异常: {exc}", exc_info=True)
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")
    logger.error(f"堆栈跟踪:\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

# 挂载静态文件目录（必须在其他路由之前）
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    # 挂载所有静态文件（PNG, SVG, ICO等）
    app.mount("/static", StaticFiles(directory=frontend_dist, html=False), name="static")
if os.path.exists(os.path.join(frontend_dist, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

# 注册路由（带 /api 前缀用于前端）
app.include_router(users.router, prefix="/api")
app.include_router(timeline.router, prefix="/api/timeline")
app.include_router(conversations.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(soul.router, prefix="/api")
app.include_router(workspace.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(heartbeat.router, prefix="/api")
# 注册 WebSocket 路由（不带 /api 前缀）
app.include_router(websocket.router)


@app.get("/health")
async def health_check():
    """心跳接口，检查后端服务是否存活"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/manifest.webmanifest")
async def serve_manifest():
    """提供 PWA manifest 文件，设置正确的 MIME 类型"""
    manifest_file = os.path.join(frontend_dist, "manifest.webmanifest")
    if os.path.exists(manifest_file):
        return FileResponse(
            manifest_file,
            media_type="application/manifest+json"
        )
    return {"error": "Manifest not found"}, 404


# SPA fallback: 所有未匹配的路由返回 index.html
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """提供前端 SPA 应用"""
    # 跳过 API 路径
    if full_path.startswith("api/"):
        return {"error": "API endpoint not found"}, 404

    # 尝试直接提供静态文件
    requested_file = os.path.join(frontend_dist, full_path)
    if os.path.exists(requested_file) and os.path.isfile(requested_file):
        # 根据文件扩展名设置 MIME 类型
        media_type = None
        if full_path.endswith(".png"):
            media_type = "image/png"
        elif full_path.endswith(".svg"):
            media_type = "image/svg+xml"
        elif full_path.endswith(".jpg") or full_path.endswith(".jpeg"):
            media_type = "image/jpeg"
        elif full_path.endswith(".ico"):
            media_type = "image/x-icon"
        elif full_path.endswith(".webmanifest"):
            media_type = "application/manifest+json"

        if media_type:
            return FileResponse(requested_file, media_type=media_type)
        return FileResponse(requested_file)

    # 默认返回 index.html
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "Frontend not built. Please run 'npm run build' in frontend directory first."}, 503


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18520)
