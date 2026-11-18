import io
import pandas as pd
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord, User
from app.core.security import get_current_user
from app.services.analytics.timeline import TimelineAnalyticsService
from app.services.analytics.imei_tracker import IMEITrackerService
from app.services.analytics.report_generator import ForensicReportService
from app.services.analytics.party_analysis import PartyAnalysisService
from app.services.analytics.duration_analytics import DurationAnalyticsService
from app.services.analytics.deep_investigation import DeepInvestigationService

router = APIRouter(prefix="/analytics", tags=["Analytics & Forensics"])

@router.get("/timeline/{case_id}")
def get_timeline(case_id: str, caller: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = TimelineAnalyticsService.get_frequency_matrix(db, case_id=case_id, caller_filter=caller)
    return data

@router.get("/imei-swaps/{case_id}")
def get_imei_swaps(case_id: str, min_swaps: int = Query(1, ge=1), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return IMEITrackerService.detect_swaps(db, case_id=case_id, min_swaps=min_swaps)

@router.get("/silent-periods/{case_id}")
def get_silent_periods(
    case_id: str,
    target_msisdn: Optional[str] = Query(None, description="Target phone number to audit inactivity for"),
    min_gap_hours: float = Query(3.0, ge=0.5, le=72.0, description="Minimum silence gap in hours"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
def get_summary(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return ForensicReportService.generate_case_summary(db, case_id)

@router.get("/export/pdf/{case_id}")
def export_pdf_report(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
def export_excel_report(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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

@router.get("/party-analysis/{case_id}")
def get_party_call_analysis(
    case_id: str,
    party_a: Optional[str] = Query(None, description="Party A phone number (caller or anchor)"),
    party_b: Optional[str] = Query(None, description="Party B phone number (receiver or peer)"),
    direction: Optional[str] = Query("ALL", description="Direction filter: A_TO_B, B_TO_A, or ALL"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_duration: Optional[int] = Query(None, ge=0, description="Minimum duration in seconds"),
    max_duration: Optional[int] = Query(None, ge=0, description="Maximum duration in seconds"),
    call_type: Optional[str] = Query(None, description="Call type filter: VOICE, SMS, etc."),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Feature 2: Party A / Party B Call Analysis.
    Identifies directional communications (A -> B vs B -> A), incoming/outgoing counts,
    duration totals, first/last contact, and call history table with directional arrows.
    """
    return PartyAnalysisService.get_party_call_analysis(
        db=db,
        case_id=case_id,
        party_a=party_a,
        party_b=party_b,
        direction=direction,
        start_date=start_date,
        end_date=end_date,
        min_duration=min_duration,
        max_duration=max_duration,
        call_type=call_type,
        page=page,
        page_size=page_size
    )

@router.get("/duration-analysis/{case_id}")
def get_conversation_duration_analysis(
    case_id: str,
    target_party: Optional[str] = Query(None, description="Target phone number"),
    peer_party: Optional[str] = Query(None, description="Peer / secondary phone number"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_duration: Optional[int] = Query(None, ge=0, description="Minimum duration in seconds"),
    max_duration: Optional[int] = Query(None, ge=0, description="Maximum duration in seconds"),
    call_type: Optional[str] = Query(None, description="Call type filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Feature 3: Conversation Duration Analysis.
    Computes total talking time (seconds & HH:MM:SS), average, longest, shortest,
    zero-duration count, daily and monthly duration histograms, and call history.
    """
    return DurationAnalyticsService.get_duration_analytics(
        db=db,
        case_id=case_id,
        target_party=target_party,
        peer_party=peer_party,
        start_date=start_date,
        end_date=end_date,
        min_duration=min_duration,
        max_duration=max_duration,
        call_type=call_type,
        page=page,
        page_size=page_size
    )

@router.get("/deep-investigation/{case_id}")
def get_deep_investigation(
    case_id: str,
    target_phone: str = Query(..., description="Target phone number to run deep investigation on"),
    secondary_phone: Optional[str] = Query(None, description="Secondary contact to examine path & common contacts"),
    direction: Optional[str] = Query("ALL", description="Direction filter: INCOMING, OUTGOING, ALL"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    min_duration: Optional[int] = Query(None, ge=0),
    max_duration: Optional[int] = Query(None, ge=0),
    tower_id: Optional[str] = Query(None, description="Cell tower ID filter"),
    imei: Optional[str] = Query(None, description="IMEI hardware filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Feature 4: Deep Investigation Module.
    Combines profile, communication patterns, duration, network graph, common contacts,
    shortest path, visited cell towers, co-travelers, IMEI swaps, silent periods,
    and investigative hypotheses with underlying source records.
    """
    return DeepInvestigationService.run_investigation(
        db=db,
        case_id=case_id,
        target_phone=target_phone,
        secondary_phone=secondary_phone,
        direction=direction,
        start_date=start_date,
        end_date=end_date,
        min_duration=min_duration,
        max_duration=max_duration,
        tower_id=tower_id,
        imei=imei,
        page=page,
        page_size=page_size
    )
