from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import io
import pandas as pd
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord, CaseMetadata
from app.models.pydantic_models import IngestionResult, CaseResponse, CaseCreate
from app.services.ingestion.parser_base import BaseCDRParser
from app.services.ingestion.detector import detect_parser
from app.services.graph.graph_builder import GraphBuilder

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
def create_case(case_in: CaseCreate, db: Session = Depends(get_db)):
    existing = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_in.case_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Case ID {case_in.case_id} already exists")
    new_case = CaseMetadata(
        case_id=case_in.case_id,
        case_name=case_in.case_name,
        investigator_name=case_in.investigator_name,
        description=case_in.description
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
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
    db: Session = Depends(get_db)
):
    # Ensure case exists
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
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = BaseCDRParser.load_dataframe(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    parser = detect_parser(df, operator_hint=operator or "AUTO")
    normalized_records, errors = parser.parse(df, case_id=case_id, filename=file.filename)

    if not normalized_records:
        raise HTTPException(
            status_code=422,
            detail=f"No valid records could be extracted. Errors: {'; '.join(errors[:5])}"
        )

    # Batch insert into Postgres/SQLite
    db_objects = [CDRRecord(**rec) for rec in normalized_records]
    db.add_all(db_objects)
    db.commit()

    # Sync to Neo4j if enabled
    try:
        G = GraphBuilder.build_networkx_graph(db, case_id)
        GraphBuilder.sync_to_neo4j(G, case_id)
    except Exception as e:
        pass

    return {
        "total_parsed": len(df),
        "valid_records": len(normalized_records),
        "skipped_records": len(df) - len(normalized_records),
        "operator_detected": parser.OPERATOR_NAME,
        "case_id": case_id,
        "errors": errors[:10]
    }
