import logging
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord, CaseMetadata, User
from app.models.pydantic_models import IngestionResult, CaseResponse, CaseCreate
from app.services.ingestion.parser_base import BaseCDRParser
from app.services.ingestion.detector import detect_parser
from app.services.graph.graph_builder import GraphBuilder
from app.services.analytics.chain_of_custody import ChainOfCustodyService
from app.services.analytics.case_management import CaseManagementService
from app.core.security import get_current_user, require_roles

logger = logging.getLogger("nettrace.upload")

router = APIRouter(prefix="/cases", tags=["Ingestion & Cases"])

@router.get("", response_model=List[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(CaseMetadata).all()
    res = []
    for c in cases:
        cnt = db.query(CDRRecord).filter(CDRRecord.case_id == c.case_id).count()
        res.append({
            "id": c.id,
            "case_id": c.case_id,
            "case_name": c.case_name,
            "investigator_name": c.investigator_name,
            "description": c.description,
            "status": c.status,
            "created_at": c.created_at,
            "record_count": cnt
        })
    return res

@router.post("", response_model=CaseResponse)
def create_case(case_in: CaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_in.case_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Case ID {case_in.case_id} already exists")
    new_case = CaseMetadata(
        case_id=case_in.case_id,
        case_name=case_in.case_name,
        investigator_name=case_in.investigator_name or current_user.username,
        description=case_in.description
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Log case creation to chain of custody
    ChainOfCustodyService.log_event(
        db, case_in.case_id, "CASE_CREATION", "case_manifest.json",
        raw_bytes=f"Manifest Init: Case {case_in.case_id}".encode("utf-8"),
        investigator_badge=case_in.investigator_name or current_user.badge_number or current_user.username
    )

    return {
        "id": new_case.id,
        "case_id": new_case.case_id,
        "case_name": new_case.case_name,
        "investigator_name": new_case.investigator_name,
        "description": new_case.description,
        "status": new_case.status,
        "created_at": new_case.created_at,
        "record_count": 0
    }

@router.post("/upload", response_model=IngestionResult)
async def upload_cdr_file(
    case_id: str = Form(...),
    operator: Optional[str] = Form("AUTO"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case_id = case_id.strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="Case ID cannot be empty.")

    # Ensure case exists or create on-the-fly
    case = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).first()
    if not case:
        case = CaseMetadata(
            case_id=case_id,
            case_name=f"Investigation {case_id}",
            investigator_name="Forensics Unit"
        )
        db.add(case)
        db.commit()

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    # Cryptographic SHA-256 calculation for chain of custody
    file_sha256 = hashlib.sha256(file_bytes).hexdigest()

    try:
        df = BaseCDRParser.load_dataframe(file_bytes, file.filename)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to read upload file {file.filename}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    parser = detect_parser(df, operator_hint=operator or "AUTO")
    normalized_records, errors = parser.parse(df, case_id=case_id, filename=file.filename)

    if not normalized_records:
        raise HTTPException(
            status_code=422,
            detail=f"No valid records could be extracted. Errors: {'; '.join(errors[:5]) if errors else 'Check file column headers.'}"
        )

    # Transactional batch insert into Postgres/SQLite
    try:
        db_objects = [CDRRecord(**rec) for rec in normalized_records]
        db.add_all(db_objects)
        db.commit()
    except Exception as db_err:
        db.rollback()
        logger.error(f"Database insertion failed for {file.filename}: {db_err}")
        raise HTTPException(status_code=500, detail=f"Database transaction error during ingestion: {str(db_err)}")

    # Record chain of custody log with exact cryptographic SHA-256 hash
    try:
        ChainOfCustodyService.log_event(
            db=db,
            case_id=case_id,
            event_type=f"CDR_INGESTION_{parser.OPERATOR_NAME.upper().replace(' ', '_')}",
            file_name=file.filename,
            raw_bytes=file_bytes,
            investigator_badge=case.investigator_name or "CC-9042"
        )
    except Exception as custody_err:
        logger.warning(f"Failed to log chain of custody: {custody_err}")

    # Synchronize graph to Neo4j and NetworkX with detailed logging
    graph_sync_status = "IN_MEMORY_NETWORKX"
    try:
        G = GraphBuilder.build_networkx_graph(db, case_id)
        if hasattr(GraphBuilder, "sync_to_neo4j"):
            GraphBuilder.sync_to_neo4j(G, case_id)
            graph_sync_status = "SYNCHRONIZED"
    except Exception as graph_err:
        logger.error(f"Graph synchronization error for case {case_id}: {graph_err}")
        errors.append(f"Graph sync notice: {str(graph_err)}")

    logger.info(
        f"Ingestion successful for case {case_id}: {len(normalized_records)} records saved. SHA256: {file_sha256[:16]}..."
    )

    return {
        "total_parsed": len(df),
        "valid_records": len(normalized_records),
        "skipped_records": len(df) - len(normalized_records),
        "operator_detected": parser.OPERATOR_NAME,
        "case_id": case_id,
        "errors": errors[:10],
        "graph_sync_status": graph_sync_status
    }

@router.post("/new-investigation")
def start_new_investigation(
    case_in: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Feature 1: Start New Investigation without altering existing case datasets."""
    return CaseManagementService.start_new_investigation(
        db=db,
        case_id=case_in.case_id,
        case_name=case_in.case_name,
        investigator_name=case_in.investigator_name or current_user.username,
        description=case_in.description or ""
    )

@router.delete("/{case_id}/data")
def clear_investigation_data(
    case_id: str,
    preserve_metadata: bool = True,
    badge: Optional[str] = "CC-9042",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "LEAD_INVESTIGATOR", "INVESTIGATOR"]))
):
    """
    Feature 1: Clears all imported telecommunications and analytical records
    for the specified investigation. Preserves other cases and audit history.
    """
    res = CaseManagementService.clear_investigation_data(
        db=db,
        case_id=case_id,
        operator_badge=badge or current_user.badge_number or current_user.username,
        preserve_metadata=preserve_metadata
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message", "Clear operation failed."))
    return res

@router.post("/admin/reset")
def admin_reset_all_cases(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Feature 1: Administrative Data Reset.
    Clears all case records across all investigations. Requires explicit confirmation.
    """
    confirm_text = payload.get("confirm", "").strip()
    if confirm_text != "RESET_ALL_CASES":
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase 'RESET_ALL_CASES' must be explicitly provided in request body."
        )

    badge = payload.get("badge", current_user.badge_number or "ADM-001")
    res = CaseManagementService.admin_reset_all_data(db=db, admin_badge=badge)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("message", "Administrative reset failed."))
    return res
