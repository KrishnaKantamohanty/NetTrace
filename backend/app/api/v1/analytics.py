import io
import pandas as pd
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord
from app.services.analytics.timeline import TimelineAnalyticsService
from app.services.analytics.imei_tracker import IMEITrackerService
from app.services.analytics.report_generator import ForensicReportService

router = APIRouter(prefix="/analytics", tags=["Analytics & Forensics"])

@router.get("/timeline/{case_id}")
def get_timeline(case_id: str, caller: Optional[str] = None, db: Session = Depends(get_db)):
    data = TimelineAnalyticsService.get_frequency_matrix(db, case_id=case_id, caller_filter=caller)
    return data

@router.get("/imei-swaps/{case_id}")
def get_imei_swaps(case_id: str, min_swaps: int = Query(1, ge=1), db: Session = Depends(get_db)):
    return IMEITrackerService.detect_swaps(db, case_id=case_id, min_swaps=min_swaps)

@router.get("/silent-periods/{case_id}")
def get_silent_periods(
    case_id: str,
    target_msisdn: Optional[str] = Query(None, description="Target phone number to audit inactivity for"),
    min_gap_hours: float = Query(3.0, ge=0.5, le=72.0, description="Minimum silence gap in hours"),
    db: Session = Depends(get_db)
):
    """
    Silent Period Detection: Tracks gaps where a target phone had zero activity
    (device switch-off / airplane mode) and flags suspicious blackout windows.
    """
    from app.services.analytics.silent_period import SilentPeriodService
    return SilentPeriodService.detect_silent_periods(
        db=db,
        case_id=case_id,
        target_msisdn=target_msisdn,
        min_gap_hours=min_gap_hours
    )

@router.get("/imei-sim-timeline/{case_id}")
def get_imei_sim_timeline(
    case_id: str,
    target: Optional[str] = Query(None, description="Filter by MSISDN or IMEI"),
    db: Session = Depends(get_db)
):
    """
    IMEI-SIM Swap Timeline: Generates a tabular / matrix timeline showing
    exact date ranges a SIM was active in specific IMEIs.
    """
    from app.services.analytics.imei_sim_timeline import IMEISIMTimelineService
    return IMEISIMTimelineService.get_swap_timeline(
        db=db,
        case_id=case_id,
        target_filter=target
    )

@router.get("/summary/{case_id}")
def get_summary(case_id: str, db: Session = Depends(get_db)):
    return ForensicReportService.generate_case_summary(db, case_id)

@router.get("/export/pdf/{case_id}")
def export_pdf_report(case_id: str, db: Session = Depends(get_db)):
    pdf_bytes = ForensicReportService.generate_pdf_report(db, case_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Forensic_Report_{case_id}.pdf"}
    )

@router.get("/export/section-65b/{case_id}")
def export_section_65b_certificate(
    case_id: str,
    user_id: str = Query("IO-CYBER-9042", description="Investigator ID / Badge number"),
    officer_name: str = Query("Inspector R. K. Sharma", description="Certifying officer name"),
    police_station: str = Query("Special Cyber Crime Unit", description="Police station jurisdiction"),
    db: Session = Depends(get_db)
):
    """
    Legal Compliance: Generates a downloadable Section 65B Audit Log Certificate PDF
    documenting File Name, SHA-256 Hash, Upload Timestamp, and User ID under
    Section 65B Indian Evidence Act / Section 63 BSA 2023.
    """
    from app.services.analytics.legal_compliance import LegalComplianceService
    pdf_bytes = LegalComplianceService.generate_section_65b_pdf(
        db=db,
        case_id=case_id,
        user_id=user_id,
        officer_name=officer_name,
        police_station=police_station
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Section_65B_Certificate_{case_id}.pdf"}
    )

@router.get("/export/excel/{case_id}")
def export_excel_report(case_id: str, db: Session = Depends(get_db)):
    records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
    if not records:
        raise HTTPException(status_code=404, detail="No records found to export.")

    data = []
    for r in records:
        data.append({
            "Record ID": r.id,
            "Case ID": r.case_id,
            "Caller Number": r.caller_number,
            "Receiver Number": r.receiver_number,
            "Date Time": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "Duration (s)": r.duration_seconds,
            "Call Type": r.call_type,
            "IMEI": r.imei,
            "IMSI": r.imsi,
            "Cell Tower ID": r.cell_tower_id,
            "Latitude": r.latitude,
            "Longitude": r.longitude,
            "Operator": r.operator
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="CDR_Master_Evidence")
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=CDR_Evidence_Export_{case_id}.xlsx"}
    )
