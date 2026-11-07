import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NetTrace CDR Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production-cdr-forensics-nettrace-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours

    # Database
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL", None)
    USE_SQLITE_FALLBACK: bool = os.getenv("USE_SQLITE_FALLBACK", "true").lower() == "true"
    SQLITE_URL: str = "sqlite:///./cdr_forensics.db"

    # Neo4j
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password123")
    USE_NEO4J: bool = os.getenv("USE_NEO4J", "false").lower() == "true"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    model_config = {
        "case_sensitive": True,
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()
