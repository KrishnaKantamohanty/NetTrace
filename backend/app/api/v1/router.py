from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord, CaseMetadata, User
from app.core.security import get_password_hash
from app.api.v1.auth import router as auth_router
from app.api.v1.upload import router as upload_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.gis import router as gis_router
from app.api.v1.network import router as network_router
from app.api.v1.advanced_forensics import router as advanced_forensics_router
from app.models.postgres_models import (
    IPDRRecord, TelemetryRecord, AudioInterceptRecord,
    OCRDocumentRecord, OSINTProfile, GeofenceRule, ChainOfCustodyLog
)
from app.services.osint.enrichment import OSINTEnrichmentService
import json
import hashlib

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(analytics_router)
api_router.include_router(gis_router)
api_router.include_router(network_router)
api_router.include_router(advanced_forensics_router)

@api_router.post("/seed-demo-data", tags=["Development & Demo"])
def seed_demo_data(db: Session = Depends(get_db)):
    """Seeds a realistic cyber-forensic case with Airtel, Jio, VI records for instant testing."""
    case_id = "CASE-DL-2026-904"
    
    # 1. Ensure user
    investigator = db.query(User).filter(User.username == "investigator").first()
    if not investigator:
        investigator = User(
            username="investigator",
            email="investigator@cybercell.gov.in",
            hashed_password=get_password_hash("forensics2026"),
            badge_number="CC-9042",
            role="LEAD_INVESTIGATOR"
        )
        db.add(investigator)

    # 2. Case metadata
    case = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).first()
    if not case:
        case = CaseMetadata(
            case_id=case_id,
            case_name="Operation NetTrace: Inter-State Cyber Fraud & Hawala Syndicate",
            investigator_name="Insp. Vikram Rathore (Cyber Cell)",
            description="Forensic investigation into coordinated telecom communications, IMEI hopping, and cell tower dump traces across Delhi-NCR corridor."
        )
        db.add(case)
        db.commit()

    # Clear existing records for this case if any
    db.query(CDRRecord).filter(CDRRecord.case_id == case_id).delete()
    db.commit()

    # Realistic Towers in Delhi NCR
    towers = [
        {"id": "DEL-CP-TOW-01", "lat": 28.6315, "lng": 77.2167, "name": "Connaught Place Radial 1"},
        {"id": "DEL-KB-TOW-04", "lat": 28.6517, "lng": 77.1906, "name": "Karol Bagh Market Sector"},
        {"id": "DEL-ROH-TOW-12", "lat": 28.7159, "lng": 77.1130, "name": "Rohini Sector 14 Tower"},
        {"id": "NOI-SEC62-TOW-08", "lat": 28.6280, "lng": 77.3649, "name": "Noida Electronic City Gate"},
        {"id": "GGN-CYB-TOW-05", "lat": 28.4952, "lng": 77.0895, "name": "Gurugram Cyber City DLF Ph-2"},
        {"id": "DEL-NDLS-TOW-02", "lat": 28.6430, "lng": 77.2194, "name": "New Delhi Railway Stn North"},
    ]

    # Target Suspects & Hubs
    kingpin = "9811012345" # Main Kingpin (Airtel)
    lieutenant_1 = "9876543210" # Field coordinator (Jio)
    lieutenant_2 = "9998887771" # Money mule handler (VI)
    mule_1 = "9123456780"
    mule_2 = "9123456781"
    mule_3 = "9123456782"
    mule_4 = "9123456783"
    hawala_broker = "9822334455" # Bridge node
    corrupt_associate = "9711223344"

    shared_imei_device = "864920048192831" # Burner phone shared by mules
    kingpin_imei = "359281094829104"
    lt1_imei = "862049182948201"
    lt2_imei = "862049182948202"

    operators = ["Airtel", "Jio", "Vodafone Idea (VI)"]

    base_time = datetime(2026, 10, 1, 9, 0, 0)
    records = []

    # 1. Kingpin <-> Lieutenants interactions (High volume, high duration)
    for day in range(7):
        for rep in range(4):
            t_offset = timedelta(days=day, hours=random.choice([1, 2, 3, 14, 18, 23]), minutes=random.randint(5, 50))
            ts = base_time + t_offset
            tw = random.choice(towers[:3])
            records.append(CDRRecord(
                case_id=case_id,
                caller_number=kingpin,
                receiver_number=lieutenant_1,
                timestamp=ts,
                duration_seconds=random.randint(120, 1800),
                call_type="VOICE",
                imei=kingpin_imei,
                cell_tower_id=tw["id"],
                latitude=tw["lat"] + random.uniform(-0.005, 0.005),
                longitude=tw["lng"] + random.uniform(-0.005, 0.005),
                operator="Airtel",
                raw_source="airtel_cdr_oct2026.csv"
            ))

        for rep in range(3):
            t_offset = timedelta(days=day, hours=random.choice([0, 1, 15, 20]), minutes=random.randint(5, 50))
            ts = base_time + t_offset
            tw = random.choice(towers[:3])
            records.append(CDRRecord(
                case_id=case_id,
                caller_number=kingpin,
                receiver_number=lieutenant_2,
                timestamp=ts,
                duration_seconds=random.randint(90, 1200),
                call_type="VOICE",
                imei=kingpin_imei,
                cell_tower_id=tw["id"],
                latitude=tw["lat"] + random.uniform(-0.005, 0.005),
                longitude=tw["lng"] + random.uniform(-0.005, 0.005),
                operator="Airtel",
                raw_source="airtel_cdr_oct2026.csv"
            ))

    # 2. Lieutenant 1 with Mules (Burner Handset Swaps!)
    mules = [mule_1, mule_2, mule_3, mule_4]
    for idx, m in enumerate(mules):
        for rep in range(5):
            ts = base_time + timedelta(days=random.randint(0, 6), hours=random.choice([1, 2, 11, 16, 22]), minutes=random.randint(0, 55))
            tw = towers[3] if idx % 2 == 0 else towers[4]
            records.append(CDRRecord(
                case_id=case_id,
                caller_number=lieutenant_1,
                receiver_number=m,
                timestamp=ts,
                duration_seconds=random.randint(30, 450),
                call_type=random.choice(["VOICE", "SMS"]),
                imei=lt1_imei,
                cell_tower_id=tw["id"],
                latitude=tw["lat"] + random.uniform(-0.003, 0.003),
                longitude=tw["lng"] + random.uniform(-0.003, 0.003),
                operator="Jio",
                raw_source="jio_dump_oct2026.xlsx"
            ))

            # Mules using shared burner device
            records.append(CDRRecord(
                case_id=case_id,
                caller_number=m,
                receiver_number=lieutenant_1,
                timestamp=ts + timedelta(minutes=10),
                duration_seconds=random.randint(45, 300),
                call_type="VOICE",
                imei=shared_imei_device, # IMEI Swap!
                cell_tower_id=tw["id"],
                latitude=tw["lat"] + random.uniform(-0.002, 0.002),
                longitude=tw["lng"] + random.uniform(-0.002, 0.002),
                operator="Vodafone Idea (VI)",
                raw_source="vi_cdr_oct2026.csv"
            ))

    # 3. Hawala Broker (Bridge) connecting Lieutenant 2 and Corrupt Associate
    for day in range(6):
        ts = base_time + timedelta(days=day, hours=random.choice([2, 3, 21]), minutes=random.randint(10, 45))
        tw = towers[1]
        records.append(CDRRecord(
            case_id=case_id,
            caller_number=lieutenant_2,
            receiver_number=hawala_broker,
            timestamp=ts,
            duration_seconds=random.randint(180, 720),
            call_type="VOICE",
            imei=lt2_imei,
            cell_tower_id=tw["id"],
            latitude=tw["lat"],
            longitude=tw["lng"],
            operator="Vodafone Idea (VI)",
            raw_source="vi_cdr_oct2026.csv"
        ))
        records.append(CDRRecord(
            case_id=case_id,
            caller_number=hawala_broker,
            receiver_number=corrupt_associate,
            timestamp=ts + timedelta(minutes=5),
            duration_seconds=random.randint(200, 600),
            call_type="VOICE",
            imei="867749102948172",
            cell_tower_id=towers[5]["id"],
            latitude=towers[5]["lat"],
            longitude=towers[5]["lng"],
            operator="Airtel",
            raw_source="airtel_cdr_oct2026.csv"
        ))

    # 4. Background peripheral traffic
    for i in range(40):
        c1 = f"98710{random.randint(10000, 99999)}"
        c2 = random.choice([kingpin, lieutenant_1, lieutenant_2, hawala_broker])
        tw = random.choice(towers)
        ts = base_time + timedelta(days=random.randint(0, 6), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        records.append(CDRRecord(
            case_id=case_id,
            caller_number=c1,
            receiver_number=c2,
            timestamp=ts,
            duration_seconds=random.randint(10, 360),
            call_type=random.choice(["VOICE", "SMS", "DATA"]),
            imei=f"86{random.randint(1000000000000, 9999999999999)}",
            cell_tower_id=tw["id"],
            latitude=tw["lat"] + random.uniform(-0.01, 0.01),
            longitude=tw["lng"] + random.uniform(-0.01, 0.01),
            operator=random.choice(operators),
            raw_source="mixed_forensic_feed.csv"
        ))

    db.add_all(records)
    db.commit()

    # Clear prior auxiliary records for case
    db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).delete()
    db.query(TelemetryRecord).filter(TelemetryRecord.case_id == case_id).delete()
    db.query(AudioInterceptRecord).filter(AudioInterceptRecord.case_id == case_id).delete()
    db.query(OCRDocumentRecord).filter(OCRDocumentRecord.case_id == case_id).delete()
    db.query(GeofenceRule).filter(GeofenceRule.case_id == case_id).delete()
    db.query(ChainOfCustodyLog).filter(ChainOfCustodyLog.case_id == case_id).delete()
    db.commit()

    # 5. Realistic IPDR Logs (WhatsApp / Telegram VoIP & Data consumption)
    ipdr_list = []
    app_types = ["WhatsApp", "Telegram", "Signal", "VoIP", "HTTPS", "DNS"]
    for day in range(5):
        for s in [kingpin, lieutenant_1, lieutenant_2, hawala_broker, mule_1]:
            t_sess = base_time + timedelta(days=day, hours=random.randint(1, 23), minutes=random.randint(5, 55))
            proto = random.choice(app_types)
            up = random.randint(50000, 15000000)
            down = random.randint(120000, 45000000)
            ipdr_list.append(IPDRRecord(
                case_id=case_id,
                msisdn=s,
                source_ip=f"10.244.{random.randint(1, 250)}.{random.randint(1, 250)}",
                source_port=random.randint(30000, 65000),
                dest_ip=f"157.240.{random.randint(10, 240)}.{random.randint(1, 240)}" if "WhatsApp" in proto else f"149.154.{random.randint(100, 200)}.{random.randint(1, 250)}",
                dest_port=443 if "HTTP" in proto or "WhatsApp" in proto else random.choice([5222, 8443, 3478]),
                app_protocol=proto,
                bytes_uploaded=up,
                bytes_downloaded=down,
                session_start=t_sess,
                session_end=t_sess + timedelta(seconds=random.randint(45, 900)),
                duration_seconds=random.randint(45, 900),
                cell_tower_id=random.choice(towers)["id"]
            ))
    db.add_all(ipdr_list)

    # 6. Device Telemetry Events (Critical battery, shutdown, flight mode toggles)
    telemetry_list = [
        TelemetryRecord(
            case_id=case_id,
            msisdn=lieutenant_1,
            imei=lt1_imei,
            event_type="DEVICE_SHUTDOWN",
            battery_level=8,
            timestamp=base_time + timedelta(days=2, hours=3, minutes=15),
            cell_tower_id="DEL-KB-TOW-04",
            signal_strength_dbm=-102,
            notes="Device abruptly powered down immediately following midnight call with Kingpin."
        ),
        TelemetryRecord(
            case_id=case_id,
            msisdn=mule_1,
            imei=shared_imei_device,
            event_type="FLIGHT_MODE_ON",
            battery_level=64,
            timestamp=base_time + timedelta(days=3, hours=1, minutes=45),
            cell_tower_id="NOI-SEC62-TOW-08",
            signal_strength_dbm=-88,
            notes="Airplane mode engaged right after receiving Hawala coordination SMS."
        ),
        TelemetryRecord(
            case_id=case_id,
            msisdn=hawala_broker,
            imei="867749102948172",
            event_type="CELL_HANDOVER",
            battery_level=42,
            timestamp=base_time + timedelta(days=4, hours=22, minutes=30),
            cell_tower_id="DEL-CP-TOW-01",
            signal_strength_dbm=-75,
            notes="Rapid radio handover detected from Karol Bagh to Connaught Place."
        ),
        TelemetryRecord(
            case_id=case_id,
            msisdn=mule_2,
            imei=shared_imei_device,
            event_type="BATTERY_CRITICAL",
            battery_level=4,
            timestamp=base_time + timedelta(days=5, hours=2, minutes=10),
            cell_tower_id="GGN-CYB-TOW-05",
            signal_strength_dbm=-108,
            notes="Hardware alert: Battery critical event in Cyber City transit zone."
        )
    ]
    db.add_all(telemetry_list)

    # 7. Audio Intercepts (Whisper Transcripts with Crime Slang Spotting)
    audio_list = [
        AudioInterceptRecord(
            case_id=case_id,
            caller_number=kingpin,
            receiver_number=lieutenant_1,
            timestamp=base_time + timedelta(days=1, hours=2, minutes=14),
            duration_seconds=52,
            audio_file_url="/audio_vault/intercept_rec_kp_lt1_01.mp3",
            language_detected="Hindi / Punjabi",
            transcription_raw="Bhai, consignment ka maal Delhi border cross kar chuka hai. Rohini godown me drop karao. Hawala broker ko bolo cash release kare.",
            translation_english="Brother, the consignment has crossed the Delhi border. Drop it at Rohini godown. Tell the hawala broker to release the cash.",
            flagged_keywords=json.dumps(["consignment", "maal", "border", "hawala", "cash", "location"]),
            threat_severity="CRITICAL",
            sentiment="CONSPIRACY_HIGH"
        ),
        AudioInterceptRecord(
            case_id=case_id,
            caller_number=lieutenant_2,
            receiver_number=hawala_broker,
            timestamp=base_time + timedelta(days=2, hours=3, minutes=2),
            duration_seconds=38,
            audio_file_url="/audio_vault/intercept_rec_lt2_hb_02.mp3",
            language_detected="Hindi (Delhi Slang)",
            transcription_raw="Pachaas khoka ka transaction hai. Token number 9042 hai. Karol Bagh wali dukan pe subah 10 baje banda aayega paisa lene.",
            translation_english="It is a transaction of 50 Lakhs. The security token number is 9042. A guy will arrive at the Karol Bagh shop at 10 AM to collect the money.",
            flagged_keywords=json.dumps(["khoka", "transaction", "token", "paisa", "hawala"]),
            threat_severity="CRITICAL",
            sentiment="FINANCIAL_FRAUD"
        ),
        AudioInterceptRecord(
            case_id=case_id,
            caller_number=mule_1,
            receiver_number=lieutenant_1,
            timestamp=base_time + timedelta(days=3, hours=16, minutes=40),
            duration_seconds=29,
            audio_file_url="/audio_vault/intercept_rec_mule_lt1_03.mp3",
            language_detected="Hindi",
            transcription_raw="Naya SIM handset me daal diya hai. Purana SIM destroy kar diya. Dusra UPI handle ready hai transfer ke liye.",
            translation_english="Inserted the new SIM into the handset. Destroyed the old SIM. The second UPI handle is ready for the transfer.",
            flagged_keywords=json.dumps(["sim", "handset", "destroy", "upi"]),
            threat_severity="HIGH",
            sentiment="EVASION"
        )
    ]
    db.add_all(audio_list)

    # 8. Multi-Script OCR Scans (Police FIRs, Seizure Memos)
    ocr_list = [
        OCRDocumentRecord(
            case_id=case_id,
            filename="FIR_Delhi_Special_Cell_142_2026.pdf",
            doc_type="POLICE_FIR",
            script_detected="Devanagari (Hindi) + Latin (English)",
            extracted_text="प्रथम सूचना रिपोर्ट (FIR No: 142/2026)\nथाना: स्पेशल सेल, लोधी कॉलोनी, नई दिल्ली\nधारा: 420/120B IPC & 66D IT Act\nजाँच अधिकारी: Insp. Vikram Rathore (CC-9042)\nसंदेहास्पद मोबाइल नंबर: 9811012345, 9876543210, 9998887771\nहैंडसेट IMEI: 864920048192831, 359281094829104\nघटना स्थल: रोहिणी सेक्टर 14 एवं करोल बाग",
            translation_english="First Information Report (FIR No: 142/2026)\nPolice Station: Special Cell, Lodhi Colony, New Delhi\nSections: 420/120B IPC & 66D IT Act\nIO: Insp. Vikram Rathore (CC-9042)\nTarget Mobile Numbers: 9811012345, 9876543210, 9998887771\nHandset IMEIs: 864920048192831, 359281094829104\nCrime Sites: Rohini Sector 14 & Karol Bagh",
            extracted_entities=json.dumps({
                "phone_numbers": [kingpin, lieutenant_1, lieutenant_2],
                "imeis": [shared_imei_device, kingpin_imei],
                "locations": ["Rohini Sector 14", "Karol Bagh", "Lodhi Colony"]
            }),
            confidence_score=0.97
        ),
        OCRDocumentRecord(
            case_id=case_id,
            filename="Hawala_Slips_Seized_Karol_Bagh.jpg",
            doc_type="SEIZURE_MEMO",
            script_detected="Devanagari (Hindi)",
            extracted_text="जब्ती मेमो (Seizure Memo)\nस्थान: करोल बाग मार्केट\nबरामद सामग्री: ₹45,00,000 नकद, 6 बर्नर मोबाइल फोन\nकोड पर्ची: 9822334455 / टोकन 9042 / पार्टी दिल्ली-दुबई हवाला",
            translation_english="Seizure Memo\nLocation: Karol Bagh Market\nRecovered: ₹45,00,000 cash, 6 burner mobile phones\nCode Slip: 9822334455 / Token 9042 / Party Delhi-Dubai Hawala",
            extracted_entities=json.dumps({
                "phone_numbers": [hawala_broker],
                "imeis": [],
                "locations": ["Karol Bagh Market", "Delhi", "Dubai"]
            }),
            confidence_score=0.94
        )
    ]
    db.add_all(ocr_list)

    # 9. OSINT Profiles for Syndicate Nodes
    for target in [kingpin, lieutenant_1, lieutenant_2, hawala_broker, mule_1, mule_2]:
        OSINTEnrichmentService.get_or_create_profile(db, target)

    # 10. Geofence Perimeters & Breach Alerts
    fences = [
        GeofenceRule(
            case_id=case_id,
            fence_name="IGI Airport Cargo & Transit Zone",
            center_lat=28.5562,
            center_lng=77.1000,
            radius_meters=3000.0,
            color="#f43f5e",
            breach_count=12
        ),
        GeofenceRule(
            case_id=case_id,
            fence_name="Rohini Hawala Safehouse Cluster",
            center_lat=28.7159,
            center_lng=77.1130,
            radius_meters=1800.0,
            color="#f59e0b",
            breach_count=28
        ),
        GeofenceRule(
            case_id=case_id,
            fence_name="Noida Sector 62 Cyber Mule Hub",
            center_lat=28.6280,
            center_lng=77.3649,
            radius_meters=2200.0,
            color="#06b6d4",
            breach_count=19
        )
    ]
    db.add_all(fences)

    # 11. SHA-256 Tamper-Evident Chain of Custody Audit Ledger
    custody_entries = [
        ChainOfCustodyLog(
            case_id=case_id,
            event_type="CASE_CREATION",
            file_name="case_manifest.json",
            sha256_hash=hashlib.sha256(f"{case_id}:MANIFEST:2026".encode("utf-8")).hexdigest(),
            investigator_badge="CC-9042",
            ip_address="127.0.0.1",
            timestamp=base_time,
            verification_status="VERIFIED_SECURE"
        ),
        ChainOfCustodyLog(
            case_id=case_id,
            event_type="CDR_INGESTION_AIRTEL",
            file_name="airtel_cdr_oct2026.csv",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            investigator_badge="CC-9042",
            ip_address="127.0.0.1",
            timestamp=base_time + timedelta(minutes=5),
            verification_status="VERIFIED_SECURE"
        ),
        ChainOfCustodyLog(
            case_id=case_id,
            event_type="IPDR_INGESTION_OTT",
            file_name="ipdr_session_logs.xlsx",
            sha256_hash="4a8a08f09d37b73795649038408b5f330061e3269b6348c41f71a4f107380126",
            investigator_badge="CC-9042",
            ip_address="127.0.0.1",
            timestamp=base_time + timedelta(minutes=8),
            verification_status="VERIFIED_SECURE"
        ),
        ChainOfCustodyLog(
            case_id=case_id,
            event_type="SPEECH_AI_TRANSCRIPTION",
            file_name="intercept_rec_kp_lt1_01.mp3",
            sha256_hash="a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
            investigator_badge="CC-9042",
            ip_address="127.0.0.1",
            timestamp=base_time + timedelta(minutes=14),
            verification_status="VERIFIED_SECURE"
        ),
        ChainOfCustodyLog(
            case_id=case_id,
            event_type="OCR_DOCUMENT_SCAN",
            file_name="FIR_Delhi_Special_Cell_142_2026.pdf",
            sha256_hash="7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            investigator_badge="CC-9042",
            ip_address="127.0.0.1",
            timestamp=base_time + timedelta(minutes=20),
            verification_status="VERIFIED_SECURE"
        )
    ]
    db.add_all(custody_entries)
    db.commit()

    return {
        "status": "success",
        "case_id": case_id,
        "case_name": case.case_name,
        "records_generated": len(records),
        "ipdr_sessions": len(ipdr_list),
        "telemetry_events": len(telemetry_list),
        "audio_intercepts": len(audio_list),
        "ocr_scans": len(ocr_list),
        "target_nodes": [kingpin, lieutenant_1, lieutenant_2, hawala_broker, corrupt_associate]
    }

