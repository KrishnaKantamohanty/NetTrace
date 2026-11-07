import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger("nettrace.db")

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    if db_url and not settings.USE_SQLITE_FALLBACK:
        try:
            engine = create_engine(db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
            with engine.connect():
                logger.info(f"Connected to PostgreSQL database: {db_url}")
                return engine
        except Exception as e:
            logger.warning(f"Failed to connect to PostgreSQL ({e}). Falling back to SQLite.")

    # SQLite fallback
    sqlite_url = settings.SQLITE_URL
    logger.info(f"Using SQLite database engine at {sqlite_url}")
    return create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.models.postgres_models import (
        CDRRecord, TowerMetadata, CaseMetadata, User,
        IPDRRecord, TelemetryRecord, AudioInterceptRecord,
        OCRDocumentRecord, OSINTProfile, GeofenceRule, ChainOfCustodyLog
    )
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

