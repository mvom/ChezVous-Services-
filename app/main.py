import time

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.router import api_router
from app.core.config import settings
from app.core.log_config import get_logger, setup_logging


try:
    import redis as _redis_lib  # type: ignore[import]
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False


setup_logging(settings)

logger = get_logger("app.api")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Structure initiale FastAPI: routes, schemas Pydantic et couche services.",
    debug=settings.app_debug,
)

app.add_middleware(GZipMiddleware, minimum_size=512)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if not settings.enable_request_logging:
        return await call_next(request)

    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.exception(
            "request_failed",
            extra={
                "event": "request_failed",
                "method": request.method,
                "path": request.url.path,
                "duration_ms": duration_ms,
                "client": request.client.host if request.client else "unknown",
            },
        )
        raise

    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    logger.info(
        "request_completed",
        extra={
            "event": "request_completed",
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client": request.client.host if request.client else "unknown",
        },
    )
    return response


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception(
        "database_error",
        extra={"event": "database_error", "path": request.url.path},
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database operation failed", "status": "error"},
    )


app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env, "service": settings.app_name}


@app.get("/ready", tags=["Health"], response_model=None)
def readiness_check(db: Session = Depends(get_db)) -> JSONResponse:
    payload: dict[str, str] = {"environment": settings.app_env}

    try:
        db.execute(text("SELECT 1"))
        payload["database"] = "up"
    except SQLAlchemyError:
        logger.exception("readiness_check_failed", extra={"event": "readiness_check_failed"})
        payload["database"] = "down"
        payload["status"] = "error"
        return JSONResponse(status_code=503, content=payload)

    if _REDIS_AVAILABLE:
        try:
            r = _redis_lib.from_url(settings.redis_url, socket_connect_timeout=2)
            r.ping()
            payload["redis"] = "up"
        except Exception:
            payload["redis"] = "down"
    else:
        payload["redis"] = "unavailable"

    payload["status"] = "ok"
    return JSONResponse(status_code=200, content=payload)
