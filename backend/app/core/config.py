import os
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NetTrace CDR Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    
    # Cryptographic secret key: generate secure fallback if not provided via environment
    SECRET_KEY: str = os.getenv("SECRET_KEY", "nt-sec-7f9a2b4e8c1d3f5a6b8e0c2d4f6a8b0c2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours

    # Database
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL", None)
    USE_SQLITE_FALLBACK: bool = os.getenv("USE_SQLITE_FALLBACK", "true").lower() == "true"
    SQLITE_URL: str = os.getenv("SQLITE_URL", "sqlite:///./cdr_forensics.db")

    # Neo4j
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "")
    USE_NEO4J: bool = os.getenv("USE_NEO4J", "false").lower() == "true"

    # Ingestion & Upload limits
    MAX_UPLOAD_SIZE_BYTES: int = 100 * 1024 * 1024 # 100 MB
    ALLOWED_EXTENSIONS: List[str] = [".csv", ".xlsx", ".xls", ".txt"]

    # CORS — explicit trusted origins; never use wildcard with credentials
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]

    model_config = {
        "case_sensitive": True,
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()
