
from fastapi import FastAPI

from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.reviews import router as reviews_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="Analytics and ML services for Resro Intelligence",
    version="0.1.0",
)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Resro AI Intelligence Engine is running",
        "status": "ok",
        "docs": "/docs",
    }


app.include_router(health_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(reviews_router, prefix="/api/v1")
