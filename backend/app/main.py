from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select, text

from .api import router
from .config import Settings, get_settings
from .database import Database
from .models import User
from .security import hash_password
from .services import get_platform_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    database = Database(config)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if config.auto_create_schema:
            database.create_schema()
        with database.session_factory() as db:
            get_platform_settings(db, config)
            existing_admin = db.scalar(select(User).where(User.role == "admin"))
            if existing_admin is None and config.admin_initial_password:
                db.add(
                    User(
                        email=config.admin_email.lower(),
                        name=config.admin_name,
                        role="admin",
                        password_hash=hash_password(config.admin_initial_password),
                    )
                )
                db.commit()
        yield
        database.dispose()

    app = FastAPI(
        title=config.app_name,
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = config
    app.state.database = database
    app.include_router(router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; "
            "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'",
        )
        if config.environment.lower() == "production":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.url.path.startswith("/api"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.get("/health/live", tags=["health"])
    def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    def health_ready() -> dict[str, str]:
        try:
            with database.session_factory() as db:
                db.execute(text("SELECT 1"))
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
        return {"status": "ready"}

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(path: str) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Ruta API no encontrada: /api/{path}"})

    static_root = Path(__file__).resolve().parents[1] / "static"

    @app.get("/{path:path}", include_in_schema=False, response_model=None)
    def serve_frontend(path: str):
        if not static_root.exists():
            return JSONResponse(
                {"name": config.app_name, "docs": "/api/docs", "health": "/health/ready"}
            )
        requested = (static_root / path).resolve()
        if requested.is_file() and static_root.resolve() in requested.parents:
            return FileResponse(requested)
        shell = static_root / "_shell.html"
        if not shell.exists():
            shell = static_root / "index.html"
        return FileResponse(shell)

    return app


app = create_app()
