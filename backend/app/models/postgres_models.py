from datetime import datetime
from sqlalchemy import Column, BigInteger, Integer, String, Float, DateTime, Text, Index
from app.db.postgres import Base

class CDRRecord(Base):
    __tablename__ = "cdr_records"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    caller_number = Column(String(20), nullable=False, index=True)
    receiver_number = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    call_type = Column(String(15), nullable=True, default="VOICE") # VOICE, SMS, DATA, ROAMING
    imei = Column(String(30), nullable=True, index=True)
    imsi = Column(String(30), nullable=True, index=True)
    cell_tower_id = Column(String(100), nullable=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    azimuth = Column(Integer, nullable=True) # Antenna direction in degrees
    operator = Column(String(50), nullable=True) # Airtel, Jio, VI, BSNL
    raw_source = Column(String(255), nullable=True) # Source filename
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_caller_receiver", "caller_number", "receiver_number"),
        Index("idx_timestamp_case", "timestamp", "case_id"),
        Index("idx_imei_caller", "imei", "caller_number"),
    )

class TowerMetadata(Base):
    __tablename__ = "tower_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tower_id = Column(String(100), unique=True, index=True, nullable=False)
    operator = Column(String(50), nullable=True)
    circle = Column(String(50), nullable=True) # Telecom circle (e.g. Delhi, Mumbai)
    site_address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    azimuth = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CaseMetadata(Base):
    __tablename__ = "case_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(50), unique=True, index=True, nullable=False)
    case_name = Column(String(150), nullable=False)
    investigator_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="ACTIVE") # ACTIVE, CLOSED, ARCHIVED
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    badge_number = Column(String(50), nullable=True)
    role = Column(String(30), default="INVESTIGATOR") # ADMIN, INVESTIGATOR, ANALYST
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class IPDRRecord(Base):
    """IPDR: Internet Protocol Detail Records (OTT WhatsApp, Telegram, VoIP, Web Sessions)."""
    __tablename__ = "ipdr_records"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    msisdn = Column(String(20), nullable=False, index=True)
    source_ip = Column(String(45), nullable=False)
    source_port = Column(Integer, nullable=True)
    dest_ip = Column(String(45), nullable=False)
    dest_port = Column(Integer, nullable=True)
    app_protocol = Column(String(50), nullable=False) # WhatsApp, Telegram, Signal, VoIP, HTTPS
    bytes_uploaded = Column(BigInteger, default=0)
    bytes_downloaded = Column(BigInteger, default=0)
    session_start = Column(DateTime, nullable=False, index=True)
    session_end = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    cell_tower_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TelemetryRecord(Base):
    """Telemetry: Device hardware and radio events (Battery, Shutdown, Flight Mode, Cell handovers)."""
    __tablename__ = "telemetry_records"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    msisdn = Column(String(20), nullable=False, index=True)
    imei = Column(String(30), nullable=True, index=True)
    event_type = Column(String(50), nullable=False) # BATTERY_CRITICAL, DEVICE_SHUTDOWN, POWER_ON, CELL_HANDOVER, FLIGHT_MODE_ON, FLIGHT_MODE_OFF
    battery_level = Column(Integer, nullable=True) # 0 to 100
    timestamp = Column(DateTime, nullable=False, index=True)
    cell_tower_id = Column(String(100), nullable=True)
    signal_strength_dbm = Column(Integer, nullable=True) # e.g. -85 dBm
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AudioInterceptRecord(Base):
    """Tapped Call Audio Intercepts with Whisper AI Transcription & Keyword Spotting."""
    __tablename__ = "audio_intercepts"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    caller_number = Column(String(20), nullable=False, index=True)
    receiver_number = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    duration_seconds = Column(Integer, default=0)
    audio_file_url = Column(String(255), nullable=True)
    language_detected = Column(String(30), default="Hindi") # Hindi, Punjabi, Bengali, Urdu, English, Tamil
    transcription_raw = Column(Text, nullable=False)
    translation_english = Column(Text, nullable=False)
    flagged_keywords = Column(Text, nullable=True) # JSON or comma-separated: ["paisa", "maal", "hawala", "location"]
    threat_severity = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW
    sentiment = Column(String(20), default="SUSPICIOUS")
    created_at = Column(DateTime, default=datetime.utcnow)

class OCRDocumentRecord(Base):
    """Multi-Script OCR for Scanned Police FIRs, Seizure Memos, SIM KYC forms."""
    __tablename__ = "ocr_documents"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="FIR") # FIR, SEIZURE_MEMO, SIM_KYC, HANDWRITTEN_SLIP
    script_detected = Column(String(50), default="Devanagari (Hindi)")
    extracted_text = Column(Text, nullable=False)
    translation_english = Column(Text, nullable=True)
    extracted_entities = Column(Text, nullable=True) # JSON: {"phones": [], "imeis": [], "locations": []}
    confidence_score = Column(Float, default=0.92)
    created_at = Column(DateTime, default=datetime.utcnow)

class OSINTProfile(Base):
    """OSINT Enrichment: Truecaller, WhatsApp, Telegram, UPI IDs, ML Threat Index."""
    __tablename__ = "osint_profiles"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=False)
    truecaller_name = Column(String(100), nullable=True)
    carrier_circle = Column(String(100), nullable=True)
    whatsapp_status = Column(String(255), nullable=True)
    whatsapp_active = Column(Integer, default=1)
    telegram_handle = Column(String(100), nullable=True)
    upi_handles = Column(Text, nullable=True) # JSON: ["9811012345@okhdfcbank", "9811012345@paytm"]
    dark_web_mentions = Column(Integer, default=0)
    risk_score = Column(Integer, default=0) # 0 to 100
    behavioral_tags = Column(Text, nullable=True) # JSON: ["NIGHT_OWL", "BURNER_HOPPER", "HAWALA_BRIDGE"]
    last_enriched = Column(DateTime, default=datetime.utcnow)

class GeofenceRule(Base):
    """Interactive Geofencing alerts across sensitive perimeters."""
    __tablename__ = "geofence_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    fence_name = Column(String(100), nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False, default=1500.0)
    color = Column(String(20), default="#f43f5e")
    breach_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChainOfCustodyLog(Base):
    """SHA-256 Tamper-evident Audit Ledger for Court Evidence (§ 65B Indian Evidence Act)."""
    __tablename__ = "chain_of_custody_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(50), nullable=False, index=True)
    event_type = Column(String(50), nullable=False) # FILE_INGESTION, AI_TRANSCRIPTION, GRAPH_COMPUTATION, EVIDENCE_EXPORT
    file_name = Column(String(255), nullable=True)
    sha256_hash = Column(String(64), nullable=False)
    investigator_badge = Column(String(50), default="CC-9042")
    ip_address = Column(String(45), default="127.0.0.1")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    verification_status = Column(String(20), default="VERIFIED_SECURE")

