from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.postgres_models import CDRRecord

class IMEISIMTimelineService:
    @staticmethod
    def _infer_device_vendor(imei: Optional[str]) -> str:
        """Heuristic TAC (Type Allocation Code - first 8 digits) vendor mapping."""
        if not imei or len(imei) < 8:
            return "Generic Handset"
        tac = imei[:8]
        if tac.startswith("864499") or tac.startswith("868732"):
            return "Vivo / BBK Electronics"
        elif tac.startswith("354020") or tac.startswith("352841"):
            return "Apple iPhone"
        elif tac.startswith("357890") or tac.startswith("359201"):
            return "Samsung Galaxy"
        elif tac.startswith("862145") or tac.startswith("867902"):
            return "Xiaomi / Redmi"
        elif tac.startswith("860432") or tac.startswith("863921"):
            return "OnePlus / Oppo"
        elif tac.startswith("351753"):
            return "Nokia Mobile"
        return "GSM / VoLTE Handset"

    @staticmethod
    def get_swap_timeline(
        db: Session,
        case_id: str,
        target_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a chronological timeline matrix of IMEI and SIM (MSISDN/IMSI) pairings.
        Maps exact date ranges a SIM was active in specific IMEIs, identifying burner hops.
        """
        query = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id,
            CDRRecord.imei.isnot(None)
        )

        if target_filter:
            clean_tf = target_filter.strip()
            query = query.filter(
                or_(
                    CDRRecord.caller_number.ilike(f"%{clean_tf}%"),
                    CDRRecord.receiver_number.ilike(f"%{clean_tf}%"),
                    CDRRecord.imei.ilike(f"%{clean_tf}%")
                )
            )

        records = query.order_by(CDRRecord.timestamp.asc()).all()

        if not records:
            return {
                "case_id": case_id,
                "total_pairs": 0,
                "timeline": [],
                "sim_summary": {},
                "imei_summary": {}
            }

        # Pair key: (msisdn, imei)
        pair_dict: Dict[tuple, Dict[str, Any]] = {}
        sim_history: Dict[str, List[Dict[str, Any]]] = {}
        imei_history: Dict[str, List[Dict[str, Any]]] = {}

        for r in records:
            # Associate device with the originating caller (or target)
            sim = r.caller_number if r.caller_number else "UNKNOWN"
            imei = str(r.imei).strip().strip("'\"")
            imsi = str(r.imsi).strip().strip("'\"") if r.imsi else None
            t = r.timestamp

            key = (sim, imei)
            if key not in pair_dict:
                pair_dict[key] = {
                    "sim_msisdn": sim,
                    "imsi": imsi,
                    "imei": imei,
                    "device_model": IMEISIMTimelineService._infer_device_vendor(imei),
                    "first_seen": t,
                    "last_seen": t,
                    "total_events": 0,
                    "total_duration_sec": 0,
                    "voice_calls": 0,
                    "sms_count": 0,
                    "towers_visited": set(),
                    "operators": set()
                }

            entry = pair_dict[key]
            if t < entry["first_seen"]:
                entry["first_seen"] = t
            if t > entry["last_seen"]:
                entry["last_seen"] = t
            entry["total_events"] += 1
            entry["total_duration_sec"] += (r.duration_seconds or 0)
            if r.call_type == "SMS":
                entry["sms_count"] += 1
            else:
                entry["voice_calls"] += 1
            if r.cell_tower_id:
                entry["towers_visited"].add(r.cell_tower_id)
            if r.operator:
                entry["operators"].add(r.operator)

        # Convert pair_dict to list
        timeline_list = []
        for (sim, imei), data in pair_dict.items():
            duration_days = round((data["last_seen"] - data["first_seen"]).total_seconds() / 86400.0, 2)
            item = {
                "id": f"{sim}_{imei}",
                "sim_msisdn": sim,
                "imsi": data["imsi"],
                "imei": imei,
                "device_model": data["device_model"],
                "first_seen": data["first_seen"].isoformat(),
                "last_seen": data["last_seen"].isoformat(),
                "duration_days": duration_days,
                "total_events": data["total_events"],
                "total_duration_sec": data["total_duration_sec"],
                "voice_calls": data["voice_calls"],
                "sms_count": data["sms_count"],
                "towers_count": len(data["towers_visited"]),
                "operators": list(data["operators"])
            }
            timeline_list.append(item)

            # Group for SIM analysis
            if sim not in sim_history:
                sim_history[sim] = []
            sim_history[sim].append(item)

            # Group for IMEI analysis
            if imei not in imei_history:
                imei_history[imei] = []
            imei_history[imei].append(item)

        # Classify swap behavior
        for item in timeline_list:
            sim = item["sim_msisdn"]
            imei = item["imei"]

            sim_imei_count = len(sim_history.get(sim, []))
            imei_sim_count = len(imei_history.get(imei, []))

            if sim_imei_count > 1 and imei_sim_count > 1:
                item["swap_category"] = "HIGH_RISK_SYNDICATE_ROTATION"
                item["tag_color"] = "#ef4444" # red
            elif sim_imei_count > 1:
                item["swap_category"] = "DEVICE_HOPPER (Burner Swapper)"
                item["tag_color"] = "#f59e0b" # amber
            elif imei_sim_count > 1:
                item["swap_category"] = "SHARED_BURNER_HANDSET (Multi-SIM)"
                item["tag_color"] = "#8b5cf6" # purple
            else:
                item["swap_category"] = "DEDICATED_STABLE_PAIR"
                item["tag_color"] = "#10b981" # green

        # Sort chronologically by first_seen
        timeline_list.sort(key=lambda x: x["first_seen"])

        # Format SIM summary
        sim_summary = {}
        for sim, items in sim_history.items():
            sim_summary[sim] = {
                "unique_imeis_count": len(items),
                "imei_list": [it["imei"] for it in items],
                "first_activity": min(it["first_seen"] for it in items),
                "last_activity": max(it["last_seen"] for it in items),
                "is_hopper": len(items) > 1
            }

        # Format IMEI summary
        imei_summary = {}
        for imei, items in imei_history.items():
            imei_summary[imei] = {
                "unique_sims_count": len(items),
                "sim_list": [it["sim_msisdn"] for it in items],
                "device_model": items[0]["device_model"],
                "first_activity": min(it["first_seen"] for it in items),
                "last_activity": max(it["last_seen"] for it in items),
                "is_multi_sim": len(items) > 1
            }

        return {
            "case_id": case_id,
            "filter_applied": target_filter,
            "total_pairings": len(timeline_list),
            "multi_imei_sims_count": len([s for s in sim_summary.values() if s["is_hopper"]]),
            "multi_sim_imeis_count": len([i for i in imei_summary.values() if i["is_multi_sim"]]),
            "timeline": timeline_list,
            "sim_summary": sim_summary,
            "imei_summary": imei_summary
        }
