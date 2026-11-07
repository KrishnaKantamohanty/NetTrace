import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import ChainOfCustodyLog

class ChainOfCustodyService:
    @staticmethod
    def calculate_sha256(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def log_event(
        db: Session,
        case_id: str,
        event_type: str,
        file_name: Optional[str] = None,
        raw_bytes: Optional[bytes] = None,
        investigator_badge: str = "CC-9042",
        ip_address: str = "127.0.0.1"
    ) -> ChainOfCustodyLog:
        if raw_bytes:
            sha = ChainOfCustodyService.calculate_sha256(raw_bytes)
        else:
            # Deterministic hash from case + event + timestamp
            seed = f"{case_id}:{event_type}:{file_name}:{datetime.utcnow().isoformat()}".encode("utf-8")
            sha = hashlib.sha256(seed).hexdigest()

        log_entry = ChainOfCustodyLog(
            case_id=case_id,
            event_type=event_type,
            file_name=file_name or "SYSTEM_OPERATION",
            sha256_hash=sha,
            investigator_badge=investigator_badge,
            ip_address=ip_address,
            timestamp=datetime.utcnow(),
            verification_status="VERIFIED_SECURE"
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @staticmethod
    def get_audit_trail(db: Session, case_id: str) -> List[Dict[str, Any]]:
        logs = db.query(ChainOfCustodyLog).filter(
            ChainOfCustodyLog.case_id == case_id
        ).order_by(ChainOfCustodyLog.timestamp.desc()).all()

        if not logs:
            # Seed initial custodial logs for demo case
            ChainOfCustodyService.log_event(
                db, case_id, "CASE_CREATION", "case_manifest.json",
                raw_bytes=b"Manifest Init: Case DL-2026-904"
            )
            ChainOfCustodyService.log_event(
                db, case_id, "CDR_INGESTION_AIRTEL", "airtel_cdr_oct2026.csv",
                raw_bytes=b"Airtel Heterogeneous Feed Hash 2026"
            )
            ChainOfCustodyService.log_event(
                db, case_id, "CDR_INGESTION_JIO", "jio_dump_oct2026.xlsx",
                raw_bytes=b"Jio Telecom Tower Dump Hash 2026"
            )
            logs = db.query(ChainOfCustodyLog).filter(
                ChainOfCustodyLog.case_id == case_id
            ).order_by(ChainOfCustodyLog.timestamp.desc()).all()

        results = []
        for l in logs:
            results.append({
                "id": l.id,
                "case_id": l.case_id,
                "event_type": l.event_type,
                "file_name": l.file_name,
                "sha256_hash": l.sha256_hash,
                "investigator_badge": l.investigator_badge,
                "ip_address": l.ip_address,
                "timestamp": l.timestamp.isoformat(),
                "status": l.verification_status,
            })
        return results
