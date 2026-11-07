import math
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord

class CoTravelerService:
    @staticmethod
    def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates great-circle distance between two GPS coordinates in kilometers."""
        R = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    @staticmethod
    def analyze_co_travelers(
        db: Session,
        case_id: str,
        target_msisdn: Optional[str] = None,
        window_minutes: int = 30,
        min_shared_towers: int = 2
    ) -> Dict[str, Any]:
        """
        Identifies devices moving together across the same tower sequence within time windows.
        """
        # Fetch all records with valid coordinates for the case
        query = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id,
            CDRRecord.latitude.isnot(None),
            CDRRecord.longitude.isnot(None)
        ).order_by(CDRRecord.timestamp.asc())
        
        all_records = query.all()
        if not all_records:
            return {"case_id": case_id, "target": target_msisdn, "co_travelers": []}

        # Group events by phone number (caller or receiver)
        phone_trajectories: Dict[str, List[Dict[str, Any]]] = {}
        for r in all_records:
            phones_to_tag = set()
            if r.caller_number:
                phones_to_tag.add(r.caller_number)
            if r.receiver_number and len(r.receiver_number) >= 10:
                phones_to_tag.add(r.receiver_number)

            tid = r.cell_tower_id or f"TOW-{round(r.latitude, 4)}_{round(r.longitude, 4)}"
            event = {
                "id": r.id,
                "timestamp": r.timestamp,
                "tower_id": tid,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "call_type": r.call_type,
                "operator": r.operator,
                "imei": r.imei
            }
            for p in phones_to_tag:
                if p not in phone_trajectories:
                    phone_trajectories[p] = []
                phone_trajectories[p].append(event)

        # Determine target list
        if target_msisdn:
            targets = [target_msisdn]
        else:
            # Pick top 5 most active numbers as targets
            sorted_phones = sorted(phone_trajectories.keys(), key=lambda p: len(phone_trajectories[p]), reverse=True)
            targets = sorted_phones[:3]

        co_traveler_results = []

        for target in targets:
            if target not in phone_trajectories:
                continue

            target_events = phone_trajectories[target]
            candidate_phones = [p for p in phone_trajectories.keys() if p != target]

            for cand in candidate_phones:
                cand_events = phone_trajectories[cand]
                shared_checkpoints = []
                seen_towers_in_journey = set()

                for te in target_events:
                    t_time = te["timestamp"]
                    t_lat = te["latitude"]
                    t_lng = te["longitude"]
                    t_id = te["tower_id"]

                    for ce in cand_events:
                        c_time = ce["timestamp"]
                        time_delta_mins = abs((t_time - c_time).total_seconds()) / 60.0

                        if time_delta_mins <= window_minutes:
                            c_lat = ce["latitude"]
                            c_lng = ce["longitude"]
                            dist_km = CoTravelerService._haversine_distance_km(t_lat, t_lng, c_lat, c_lng)

                            # Same tower or within 1.5 km proximity
                            if t_id == ce["tower_id"] or dist_km <= 1.5:
                                checkpoint_key = f"{t_id}:{round(min(t_time, c_time).timestamp() / 600)}"
                                if checkpoint_key not in seen_towers_in_journey:
                                    seen_towers_in_journey.add(checkpoint_key)
                                    shared_checkpoints.append({
                                        "tower_id": t_id,
                                        "latitude": t_lat,
                                        "longitude": t_lng,
                                        "target_timestamp": t_time.isoformat(),
                                        "companion_timestamp": c_time.isoformat(),
                                        "time_gap_minutes": round(time_delta_mins, 1),
                                        "distance_km": round(dist_km, 3),
                                        "target_imei": te["imei"],
                                        "companion_imei": ce["imei"]
                                    })

                if len(shared_checkpoints) >= min_shared_towers:
                    # Sort checkpoints chronologically
                    shared_checkpoints.sort(key=lambda x: x["target_timestamp"])
                    
                    # Calculate co-travel metric
                    score = min(1.0, (len(shared_checkpoints) / max(len(target_events), 1)) * 1.5)
                    confidence = "HIGH" if len(shared_checkpoints) >= 4 else ("MEDIUM" if len(shared_checkpoints) >= 2 else "LOW")

                    co_traveler_results.append({
                        "target_msisdn": target,
                        "companion_msisdn": cand,
                        "shared_tower_count": len(shared_checkpoints),
                        "co_travel_score": round(score, 2),
                        "confidence": confidence,
                        "start_checkpoint": shared_checkpoints[0]["target_timestamp"],
                        "end_checkpoint": shared_checkpoints[-1]["target_timestamp"],
                        "checkpoints": shared_checkpoints
                    })

        co_traveler_results.sort(key=lambda x: (x["shared_tower_count"], x["co_travel_score"]), reverse=True)

        return {
            "case_id": case_id,
            "target_analyzed": target_msisdn or "Top Targets",
            "co_travelers_detected": len(co_traveler_results),
            "co_travelers": co_traveler_results
        }
