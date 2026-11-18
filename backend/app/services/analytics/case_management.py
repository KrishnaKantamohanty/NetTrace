import logging
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import (
    CDRRecord, TowerMetadata, CaseMetadata,
    IPDRRecord, TelemetryRecord, AudioInterceptRecord,
    OCRDocumentRecord, OSINTProfile, GeofenceRule, ChainOfCustodyLog
)
from app.db.neo4j import neo4j_client
from app.services.analytics.chain_of_custody import ChainOfCustodyService

logger = logging.getLogger("nettrace.case_management")

class CaseManagementService:
    @staticmethod
    def start_new_investigation(
        db: Session,
        case_id: str,
        case_name: str,
        investigator_name: str = "Forensics Unit",
        description: str = ""
    ) -> Dict[str, Any]:
        """
        Creates a new investigation without modifying or affecting existing cases.
        """
        clean_id = case_id.strip()
        existing = db.query(CaseMetadata).filter(CaseMetadata.case_id == clean_id).first()
        if existing:
            return {
                "success": True,
                "created": False,
                "message": f"Switched to existing investigation '{clean_id}'",
                "case": {
                    "case_id": existing.case_id,
                    "case_name": existing.case_name,
                    "investigator_name": existing.investigator_name
                }
            }

        new_case = CaseMetadata(
            case_id=clean_id,
            case_name=case_name.strip() or f"Investigation {clean_id}",
            investigator_name=investigator_name.strip() or "Forensics Unit",
            description=description.strip(),
            status="ACTIVE"
        )
        db.add(new_case)
        db.commit()
        db.refresh(new_case)

        # Audit log creation
        ChainOfCustodyService.log_event(
            db=db,
            case_id=clean_id,
            event_type="CASE_CREATION",
            file_name="case_manifest.json",
            raw_bytes=f"Created investigation {clean_id}".encode("utf-8"),
            investigator_badge=investigator_name
        )

        logger.info(f"New investigation created: {clean_id}")
        return {
            "success": True,
            "created": True,
            "message": f"Successfully initialized new investigation '{clean_id}'",
            "case": {
                "case_id": new_case.case_id,
                "case_name": new_case.case_name,
                "investigator_name": new_case.investigator_name
            }
        }

    @staticmethod
    def clear_investigation_data(
        db: Session,
        case_id: str,
        operator_badge: str = "CC-9042",
        preserve_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Safely clears all imported telecommunications and forensic records for the specified case,
        preserving users, system configuration, audit logs, and other cases.
        Synchronously removes Neo4j graph nodes for this case.
        """
        case = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).first()
        if not case:
            return {
                "success": False,
                "case_id": case_id,
                "message": f"Case '{case_id}' was not found in database."
            }

        deleted_counts = {}
        try:
            # 1. Delete CDR records
            cdr_count = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).delete()
            deleted_counts["cdr_records"] = cdr_count

            # 2. Delete IPDR records
            ipdr_count = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).delete()
            deleted_counts["ipdr_records"] = ipdr_count

            # 3. Delete Telemetry records
            telemetry_count = db.query(TelemetryRecord).filter(TelemetryRecord.case_id == case_id).delete()
            deleted_counts["telemetry_records"] = telemetry_count

            # 4. Delete Audio Intercepts
            audio_count = db.query(AudioInterceptRecord).filter(AudioInterceptRecord.case_id == case_id).delete()
            deleted_counts["audio_intercepts"] = audio_count

            # 5. Delete OCR documents
            ocr_count = db.query(OCRDocumentRecord).filter(OCRDocumentRecord.case_id == case_id).delete()
            deleted_counts["ocr_documents"] = ocr_count

            # 6. Delete Geofence rules
            gf_count = db.query(GeofenceRule).filter(GeofenceRule.case_id == case_id).delete()
            deleted_counts["geofence_rules"] = gf_count

            # 7. Optionally delete or keep case metadata
            if not preserve_metadata:
                db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).delete()
                deleted_counts["case_metadata"] = 1
            else:
                case.status = "CLEARED"

            db.commit()

            # 8. Clear graph in Neo4j
            neo4j_cleared = neo4j_client.clear_case_graph(case_id)
            deleted_counts["neo4j_cleared"] = neo4j_cleared

            # 9. Record chain of custody audit log for data clearance
            total_purged = sum(v for k, v in deleted_counts.items() if isinstance(v, int))
            ChainOfCustodyService.log_event(
                db=db,
                case_id=case_id,
                event_type="CASE_DATA_CLEARED",
                file_name=f"purge_manifest_{case_id}.json",
                raw_bytes=f"Purged {total_purged} records by officer {operator_badge}".encode("utf-8"),
                investigator_badge=operator_badge
            )

            logger.info(f"Cleared {total_purged} records for case '{case_id}' by {operator_badge}")
            return {
                "success": True,
                "case_id": case_id,
                "total_records_deleted": total_purged,
                "details": deleted_counts,
                "message": f"Successfully cleared all evidence records for case '{case_id}'. Audit record logged."
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error clearing investigation data for {case_id}: {e}")
            return {
                "success": False,
                "case_id": case_id,
                "error": str(e),
                "message": f"Failed to clear investigation data due to database error: {str(e)}"
            }

    @staticmethod
    def admin_reset_all_data(db: Session, admin_badge: str = "ADM-001") -> Dict[str, Any]:
        """
        Administrative reset: Clears all evidentiary records across all cases.
        Preserves users, system configuration, and audit logs.
        """
        try:
            cdr_count = db.query(CDRRecord).delete()
            ipdr_count = db.query(IPDRRecord).delete()
            telem_count = db.query(TelemetryRecord).delete()
            audio_count = db.query(AudioInterceptRecord).delete()
            ocr_count = db.query(OCRDocumentRecord).delete()
            gf_count = db.query(GeofenceRule).delete()
            case_count = db.query(CaseMetadata).delete()
            db.commit()

            # Clear Neo4j
            if neo4j_client.is_connected and neo4j_client.driver:
                try:
                    with neo4j_client.driver.session() as session:
                        session.run("MATCH (n) DETACH DELETE n")
                except Exception as ne:
                    logger.warning(f"Neo4j global clear error: {ne}")

            total_purged = cdr_count + ipdr_count + telem_count + audio_count + ocr_count + gf_count + case_count

            # Record in chain of custody audit log
            ChainOfCustodyService.log_event(
                db=db,
                case_id="GLOBAL_SYSTEM",
                event_type="SYSTEM_ADMIN_RESET",
                file_name="global_admin_reset.audit",
                raw_bytes=f"Full system evidentiary reset by administrator {admin_badge}".encode("utf-8"),
                investigator_badge=admin_badge
            )

            logger.warning(f"Administrative data reset performed by {admin_badge}. Purged {total_purged} records.")
            return {
                "success": True,
                "total_records_deleted": total_purged,
                "details": {
                    "cdr_records": cdr_count,
                    "ipdr_records": ipdr_count,
                    "telemetry_records": telem_count,
                    "audio_intercepts": audio_count,
                    "ocr_documents": ocr_count,
                    "cases": case_count
                },
                "message": "Administrative reset complete. All evidentiary records cleared; system audit trail preserved."
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Failed administrative data reset: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"Administrative reset failed: {str(e)}"
            }

