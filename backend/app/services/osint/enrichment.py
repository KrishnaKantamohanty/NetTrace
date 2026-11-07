import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import OSINTProfile, CDRRecord, CaseMetadata

class OSINTEnrichmentService:
    @staticmethod
    def get_or_create_profile(db: Session, phone_number: str) -> Dict[str, Any]:
        phone = phone_number.strip()
        profile = db.query(OSINTProfile).filter(OSINTProfile.phone_number == phone).first()

        if not profile:
            # Generate deterministic realistic intelligence profile based on phone digits
            last_digits = phone[-4:] if len(phone) >= 4 else "0000"
            seed_val = sum(int(c) for c in last_digits if c.isdigit())

            # Names based on Indian criminal syndicates / mules
            names_pool = [
                "Vikram 'Vicky' Sharma", "Ramesh Hawala", "Sunil Cyber Mule",
                "Mohd. Tariq", "Sandeep Rawat", "Gurpreet Singh", "Rajesh Kumar (Alias Bittu)"
            ]
            assigned_name = names_pool[seed_val % len(names_pool)]

            # Generate realistic UPI handles
            upi_handles = [
                f"{phone}@okhdfcbank",
                f"{phone}@paytm",
                f"{phone}@ybl"
            ]

            # Behavioral tags & risk score calculation
            risk = min(98, 45 + (seed_val * 4))
            tags = ["ACTIVE_UPI_PAYER"]
            if risk > 75:
                tags.extend(["HIGH_RISK_SYNDICATE", "BURNER_HOPPER"])
            if seed_val % 2 == 0:
                tags.append("NIGHT_OWL_SPIKE")

            profile = OSINTProfile(
                phone_number=phone,
                truecaller_name=assigned_name,
                carrier_circle="Delhi-NCR / Haryana",
                whatsapp_status="Hey there! Available for business only.",
                whatsapp_active=1,
                telegram_handle=f"@tg_{phone[-6:]}",
                upi_handles=json.dumps(upi_handles),
                dark_web_mentions=seed_val % 3,
                risk_score=risk,
                behavioral_tags=json.dumps(tags),
                last_enriched=datetime.utcnow()
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        # Parse JSON fields
        upi_list = []
        tags_list = []
        try:
            upi_list = json.loads(profile.upi_handles) if profile.upi_handles else []
        except Exception:
            upi_list = [profile.upi_handles]

        try:
            tags_list = json.loads(profile.behavioral_tags) if profile.behavioral_tags else []
        except Exception:
            tags_list = []

        return {
            "phone_number": profile.phone_number,
            "truecaller_name": profile.truecaller_name,
            "carrier_circle": profile.carrier_circle,
            "whatsapp_status": profile.whatsapp_status,
            "whatsapp_active": bool(profile.whatsapp_active),
            "telegram_handle": profile.telegram_handle,
            "upi_handles": upi_list,
            "dark_web_mentions": profile.dark_web_mentions,
            "risk_score": profile.risk_score,
            "behavioral_tags": tags_list,
            "last_enriched": profile.last_enriched.isoformat() if profile.last_enriched else None
        }

    @staticmethod
    def find_cross_case_correlations(db: Session, target_phone: str, current_case_id: str) -> List[Dict[str, Any]]:
        """
        Cross-Case Correlation:
        Checks if the suspect has appeared in other historical or parallel investigations!
        """
        records = db.query(CDRRecord).filter(
            (CDRRecord.caller_number == target_phone) | (CDRRecord.receiver_number == target_phone),
            CDRRecord.case_id != current_case_id
        ).all()

        cases_found: Dict[str, Dict[str, Any]] = {}
        for r in records:
            cid = r.case_id
            if cid not in cases_found:
                cases_found[cid] = {
                    "case_id": cid,
                    "hit_count": 0,
                    "first_seen": r.timestamp.isoformat(),
                    "last_seen": r.timestamp.isoformat(),
                    "imeis_used": set(),
                }
            cases_found[cid]["hit_count"] += 1
            if r.imei:
                cases_found[cid]["imeis_used"].add(r.imei)

        results = []
        for cid, data in cases_found.items():
            case_meta = db.query(CaseMetadata).filter(CaseMetadata.case_id == cid).first()
            results.append({
                "case_id": cid,
                "case_name": case_meta.case_name if case_meta else "Historical Archive Record",
                "status": case_meta.status if case_meta else "ARCHIVED",
                "transactions_matched": data["hit_count"],
                "first_detected": data["first_seen"],
                "last_detected": data["last_seen"],
                "imeis_linked": list(data["imeis_used"])
            })

        return results
