from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse
from .db import Base, engine
from . import models  # noqa: F401  (tables register)
from .routers import auth, syllabus, learn, tests, me

Base.metadata.create_all(bind=engine)

# Purane DB me naye columns ka halka migration (dev-friendly)
try:
    from sqlalchemy import inspect as _insp, text as _text
    _cols = [c["name"] for c in _insp(engine).get_columns("users")]
    if "language" not in _cols:
        with engine.begin() as _c:
            _c.execute(_text("ALTER TABLE users ADD COLUMN language VARCHAR(16) DEFAULT 'hinglish'"))
except Exception:
    pass  # dev/bootstrap; production migrations: Alembic (Chunk 6)

app = FastAPI(title="StudyQuest AI Teacher", version="0.1.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Bahut zyada requests — thoda ruk kar try karo"})

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    return resp

app.include_router(auth.router)
app.include_router(syllabus.router)
app.include_router(learn.router)
app.include_router(tests.router)
app.include_router(me.router)

@app.get("/api/health")
def health():
    return {"ok": True, "app": "StudyQuest AI Teacher", "chunk": 5}

dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.exists():
    from fastapi.responses import FileResponse
    from fastapi import HTTPException as _HTTPException
    if (dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # SPA fallback: deep-link/refresh par React app hi mile, API 404 JSON nahi
        if full_path.startswith("api/"):
            raise _HTTPException(status_code=404, detail="Not Found")
        f = dist / full_path
        if f.is_file():
            return FileResponse(str(f))
        return FileResponse(str(dist / "index.html"))
