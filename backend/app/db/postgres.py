import logging
import re
from typing import Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger("nettrace.db")

Base = declarative_base()

def sanitize_db_url(url: str) -> str:
    """Removes passwords from database URLs for safe logging."""
    if not url:
        return ""
    return re.sub(r':([^:@]+)@', ':***@', url)

def get_engine():
    db_url = settings.DATABASE_URL
    # If a PostgreSQL / external database URL is specified, try connecting first
    if db_url and not db_url.startswith("sqlite"):
        try:
            sanitized = sanitize_db_url(db_url)
            logger.info(f"Attempting connection to database: {sanitized}")
            pg_engine = create_engine(db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info(f"Successfully connected to database: {sanitized}")
            return pg_engine
        except Exception as e:
            if settings.USE_SQLITE_FALLBACK:
                logger.warning(f"Failed to connect to primary database ({e}). Falling back to SQLite.")
            else:
                logger.error(f"Failed to connect to primary database and fallback disabled: {e}")
                raise e

    # SQLite database engine
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

def check_db_health() -> Dict[str, Any]:
    """Verifies actual database connectivity with a live query."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_type = "PostgreSQL" if "postgres" in str(engine.url) else "SQLite"
        return {
            "status": "HEALTHY",
            "database_type": db_type,
            "connected": True
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "UNHEALTHY",
            "database_type": "Unknown",
            "connected": False,
            "error": str(e)
        }

def init_db():
    from app.models.postgres_models import (
        CDRRecord, TowerMetadata, CaseMetadata, User,
        IPDRRecord, TelemetryRecord, AudioInterceptRecord,
        OCRDocumentRecord, OSINTProfile, GeofenceRule, ChainOfCustodyLog
    )
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

    # Seed initial administrative and lead investigator accounts if empty
    db = SessionLocal()
    try:
        from app.core.security import get_password_hash
        user_count = db.query(User).count()
        if user_count == 0:
            logger.info("Seeding initial authorized investigator accounts...")
            admin_user = User(
                username="admin",
                email="admin@cyberforensics.local",
                hashed_password=get_password_hash("Admin@NetTrace2026"),
                badge_number="ADM-001",
                role="ADMIN",
                is_active=1
            )
            investigator_user = User(
                username="investigator",
                email="investigator@cybercell.gov.in",
                hashed_password=get_password_hash("Forensics#2026!"),
                badge_number="CC-9042",
                role="LEAD_INVESTIGATOR",
                is_active=1
            )
            db.add(admin_user)
            db.add(investigator_user)
            db.commit()
            logger.info("Default investigator accounts initialized in database with Argon2id.")
    except Exception as e:
        db.rollback()
        logger.warning(f"Initial user seed check: {e}")
    finally:
        db.close()
