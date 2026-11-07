from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord

class IMEITrackerService:
    @staticmethod
    def detect_swaps(db: Session, case_id: str, min_swaps: int = 1) -> Dict[str, Any]:
        records = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id,
            CDRRecord.imei.isnot(None),
            CDRRecord.imei != ""
        ).all()

        imei_to_sims: Dict[str, Dict[str, Any]] = {}
        sim_to_imeis: Dict[str, Dict[str, Any]] = {}

        for r in records:
            imei = str(r.imei).strip()
            caller = str(r.caller_number).strip()
            ts = r.timestamp.isoformat()

            # 1. IMEI to SIMs mapping
            if imei not in imei_to_sims:
                imei_to_sims[imei] = {
                    "imei": imei,
                    "sims": set(),
                    "records_count": 0,
                    "first_seen": ts,
                    "last_seen": ts,
                    "towers": set()
                }
            imei_to_sims[imei]["sims"].add(caller)
            imei_to_sims[imei]["records_count"] += 1
            if ts < imei_to_sims[imei]["first_seen"]:
                imei_to_sims[imei]["first_seen"] = ts
            if ts > imei_to_sims[imei]["last_seen"]:
                imei_to_sims[imei]["last_seen"] = ts
            if r.cell_tower_id:
                imei_to_sims[imei]["towers"].add(r.cell_tower_id)

            # 2. SIM to IMEIs mapping
            if caller not in sim_to_imeis:
                sim_to_imeis[caller] = {
                    "phone_number": caller,
                    "imeis": set(),
                    "records_count": 0,
                    "first_seen": ts,
                    "last_seen": ts,
                }
            sim_to_imeis[caller]["imeis"].add(imei)
            sim_to_imeis[caller]["records_count"] += 1
            if ts < sim_to_imeis[caller]["first_seen"]:
                sim_to_imeis[caller]["first_seen"] = ts
            if ts > sim_to_imeis[caller]["last_seen"]:
                sim_to_imeis[caller]["last_seen"] = ts

        # Find multi-SIM IMEIs (1 handset, multiple SIMs)
        multi_sim_handsets = []
        for imei, d in imei_to_sims.items():
            sim_count = len(d["sims"])
            if sim_count > min_swaps:
                suspicion_score = round(min(1.0, 0.4 + (sim_count - 1) * 0.2), 2)
                multi_sim_handsets.append({
                    "imei": imei,
                    "associated_sims": list(d["sims"]),
                    "sim_count": sim_count,
                    "total_calls": d["records_count"],
                    "unique_towers": len(d["towers"]),
                    "first_seen": d["first_seen"],
                    "last_seen": d["last_seen"],
                    "suspicious_score": suspicion_score,
                })

        multi_sim_handsets.sort(key=lambda x: (x["sim_count"], x["suspicious_score"]), reverse=True)

        # Find multi-IMEI SIMs (1 SIM card swapped across multiple handsets)
        multi_imei_numbers = []
        for phone, d in sim_to_imeis.items():
            imei_count = len(d["imeis"])
            if imei_count > min_swaps:
                multi_imei_numbers.append({
                    "phone_number": phone,
                    "associated_imeis": list(d["imeis"]),
                    "imei_count": imei_count,
                    "total_calls": d["records_count"],
                    "first_seen": d["first_seen"],
                    "last_seen": d["last_seen"],
                })

        multi_imei_numbers.sort(key=lambda x: x["imei_count"], reverse=True)

        return {
            "case_id": case_id,
            "total_unique_imeis": len(imei_to_sims),
            "multi_sim_handsets_count": len(multi_sim_handsets),
            "multi_imei_numbers_count": len(multi_imei_numbers),
            "multi_sim_handsets": multi_sim_handsets,
            "multi_imei_numbers": multi_imei_numbers,
        }
