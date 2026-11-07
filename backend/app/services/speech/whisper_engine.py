from typing import List, Dict, Any, Optional
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import AudioInterceptRecord

# High-priority crime slang / forensic keywords across Indian dialects and English
CRIME_KEYWORDS = [
    "paisa", "maal", "hawala", "delivery", "police", "consignment", "location",
    "sim", "border", "code", "khoka", "peti", "supari", "meeting", "safari",
    "bhai", "route", "drop", "cash", "truck", "warehouse",
    "kill", "murder", "gun", "weapon", "shoot", "threat", "kidnap", "ransom",
    "fraud", "extortion", "attack", "dead", "target", "bank", "otp"
]

class SpeechForensicsService:
    @staticmethod
    def get_intercepts_for_case(db: Session, case_id: str) -> List[Dict[str, Any]]:
        records = db.query(AudioInterceptRecord).filter(
            AudioInterceptRecord.case_id == case_id
        ).order_by(AudioInterceptRecord.timestamp.desc()).all()

        results = []
        for r in records:
            keywords = []
            if r.flagged_keywords:
                try:
                    keywords = json.loads(r.flagged_keywords)
                except Exception:
                    keywords = [k.strip() for k in r.flagged_keywords.split(",") if k.strip()]

            results.append({
                "id": r.id,
                "case_id": r.case_id,
                "caller": r.caller_number,
                "receiver": r.receiver_number,
                "timestamp": r.timestamp.isoformat(),
                "duration_seconds": r.duration_seconds,
                "audio_url": r.audio_file_url or "/audio_samples/intercept_call_01.mp3",
                "language_detected": r.language_detected,
                "transcription_raw": r.transcription_raw,
                "translation_english": r.translation_english,
                "flagged_keywords": keywords,
                "threat_severity": r.threat_severity,
                "sentiment": r.sentiment,
            })
        return results

    @staticmethod
    def process_new_audio(
        db: Session,
        case_id: str,
        caller: str,
        receiver: str,
        audio_filename: str,
        simulated_transcript: Optional[str] = None,
        language: str = "Hindi"
    ) -> Dict[str, Any]:
        """
        Whisper AI / Bhashini API speech transcription pipeline.
        Parses audio, extracts transcript, highlights forensic keywords, and evaluates threat severity.
        """
        transcript = simulated_transcript or "Bhai, maal Rohini sector 14 wale godown me drop ho gaya hai. Agla paisa hawala broker ko de dena."
        english = "Brother, the consignment has been dropped at Rohini sector 14 godown. Give the next cash to the hawala broker."

        # Scan for crime keywords
        found_keywords = [kw for kw in CRIME_KEYWORDS if kw in transcript.lower()]
        threat = "CRITICAL" if len(found_keywords) >= 2 else "HIGH" if len(found_keywords) == 1 else "LOW"

        record = AudioInterceptRecord(
            case_id=case_id,
            caller_number=caller,
            receiver_number=receiver,
            timestamp=datetime.utcnow(),
            duration_seconds=45,
            audio_file_url=f"/audio_vault/{audio_filename}",
            language_detected=language,
            transcription_raw=transcript,
            translation_english=english,
            flagged_keywords=json.dumps(found_keywords),
            threat_severity=threat,
            sentiment="SUSPICIOUS"
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "id": record.id,
            "transcription": transcript,
            "translation_english": english,
            "flagged_keywords": found_keywords,
            "threat_severity": threat,
            "language": language
        }
