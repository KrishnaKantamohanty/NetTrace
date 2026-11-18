import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.postgres import init_db, check_db_health
from app.db.neo4j import neo4j_client
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nettrace")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing NetTrace CDR Intelligence Engine...")
    init_db()
    yield
    logger.info("Shutting down NetTrace...")
    neo4j_client.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Set CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": "2.4.0",
        "status": "OPERATIONAL",
        "docs": f"{settings.API_V1_STR}/docs"
    }

@app.get("/health", tags=["System Health"])
def health_check():
    """
    Active health check verifying database and graph service dependencies.
    """
    db_health = check_db_health()
    neo4j_status = "CONNECTED" if neo4j_client.is_connected else ("DISABLED" if not settings.USE_NEO4J else "DISCONNECTED")
    
    is_healthy = db_health["connected"]
    overall_status = "HEALTHY" if is_healthy else "DEGRADED"

    return {
        "status": overall_status,
        "database": db_health,
        "graph_engine": {
            "mode": "NetworkX + Neo4j" if neo4j_client.is_connected else "NetworkX (In-Memory)",
            "neo4j_status": neo4j_status
        },
        "engine": "FastAPI",
        "version": "2.4.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
