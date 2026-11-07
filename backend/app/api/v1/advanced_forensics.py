from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.postgres import get_db
from app.services.graph.relay_chain import RelayChainService
from app.services.analytics.ipdr_analytics import IPDRAnalyticsService
from app.services.speech.whisper_engine import SpeechForensicsService
from app.services.ocr.ocr_engine import OCREngineService
from app.services.osint.enrichment import OSINTEnrichmentService
from app.services.analytics.geofence import GeofenceService
from app.services.analytics.chain_of_custody import ChainOfCustodyService

router = APIRouter(prefix="/forensics", tags=["Advanced Cyber Forensics & Intelligence"])

# 1. Domino / Relay Time-gap Matching
@router.get("/relay-chains/{case_id}")
def get_relay_chains(
    case_id: str,
    gap_minutes: int = Query(15, ge=1, le=120),
    db: Session = Depends(get_db)
):
    """Detects sequential relay calls (A -> B -> C) within a short time delta."""
    return RelayChainService.detect_relay_chains(db, case_id=case_id, max_gap_minutes=gap_minutes)

# 2. IPDR & Telemetry Analytics
@router.get("/ipdr/{case_id}")
def get_ipdr_analytics(case_id: str, db: Session = Depends(get_db)):
    """IPDR: WhatsApp/VoIP/Telegram sessions, data consumption spikes, and hardware telemetry logs."""
    return IPDRAnalyticsService.get_ipdr_summary(db, case_id=case_id)

# 3. Speech Forensics & Whisper AI Intercepts
@router.get("/speech/{case_id}")
def get_speech_intercepts(case_id: str, db: Session = Depends(get_db)):
    """Multi-lingual Whisper/Bhashini audio transcripts with crime slang keyword spotting."""
    return SpeechForensicsService.get_intercepts_for_case(db, case_id=case_id)

@router.post("/speech/analyze")
def analyze_speech_intercept(
    case_id: str = Form(...),
    caller: str = Form(...),
    receiver: str = Form(...),
    filename: str = Form("intercept_call.wav"),
    transcript: Optional[str] = Form(None),
    language: str = Form("Hindi"),
    db: Session = Depends(get_db)
):
    """Submits tapped call audio for AI transcription & keyword spotting."""
    res = SpeechForensicsService.process_new_audio(
        db=db,
        case_id=case_id,
        caller=caller,
        receiver=receiver,
        audio_filename=filename,
        simulated_transcript=transcript,
        language=language
    )
    # Log custodial hash
    ChainOfCustodyService.log_event(
        db, case_id, "SPEECH_AI_TRANSCRIPTION", filename,
        raw_bytes=res["transcription"].encode("utf-8")
    )
    return res

# 4. Multi-Script OCR Engine
@router.get("/ocr/{case_id}")
def get_ocr_records(case_id: str, db: Session = Depends(get_db)):
    """Scanned police FIRs, call slips, and SIM application forms extracted to text."""
    return OCREngineService.get_ocr_records(db, case_id=case_id)

@router.post("/ocr/scan")
def scan_document_ocr(
    case_id: str = Form(...),
    filename: str = Form("scanned_fir.jpg"),
    doc_type: str = Form("FIR"),
    raw_text: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Performs multi-script OCR on police document and extracts entities."""
    res = OCREngineService.process_scanned_document(
        db=db,
        case_id=case_id,
        filename=filename,
        doc_type=doc_type,
        raw_text=raw_text
    )
    ChainOfCustodyService.log_event(
        db, case_id, "OCR_DOCUMENT_SCAN", filename,
        raw_bytes=filename.encode("utf-8")
    )
    return res

# 5. OSINT & Behavioral Profiling
@router.get("/osint/profile/{phone}")
def get_osint_profile(phone: str, db: Session = Depends(get_db)):
    """Enriches suspect phone with Truecaller name, UPI handles, WhatsApp/Telegram status, and ML Risk Score."""
    return OSINTEnrichmentService.get_or_create_profile(db, phone_number=phone)

@router.get("/osint/cross-case/{case_id}/{phone}")
def get_cross_case_correlations(case_id: str, phone: str, db: Session = Depends(get_db)):
    """Cross-case correlation: checks if suspect appeared in historical cases."""
    return OSINTEnrichmentService.find_cross_case_correlations(db, target_phone=phone, current_case_id=case_id)

# 6. Geofencing & 4D Spatiotemporal Forensics
@router.get("/geofence/rules/{case_id}")
def get_geofence_rules(case_id: str, db: Session = Depends(get_db)):
    return GeofenceService.get_rules_for_case(db, case_id=case_id)

@router.get("/geofence/breaches/{case_id}")
def get_geofence_breaches(case_id: str, db: Session = Depends(get_db)):
    """Scans suspect locations against geofence perimeters and returns breach alerts."""
    return GeofenceService.check_geofence_breaches(db, case_id=case_id)

# 7. SHA-256 Chain of Custody Audit Ledger (§ 65B Indian Evidence Act)
@router.get("/custody-log/{case_id}")
def get_chain_of_custody(case_id: str, db: Session = Depends(get_db)):
    return ChainOfCustodyService.get_audit_trail(db, case_id=case_id)

@router.get("/section-65b-pdf/{case_id}")
def download_section_65b_pdf(
    case_id: str,
    user_id: str = Query("IO-CYBER-9042", description="Investigator ID / Badge number"),
    officer_name: str = Query("Inspector R. K. Sharma", description="Certifying officer name"),
    police_station: str = Query("Special Cyber Crime Unit", description="Police station jurisdiction"),
    db: Session = Depends(get_db)
):
    """Generates official Section 65B Evidence Act certificate PDF."""
    from fastapi.responses import Response
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

