import math
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord

class TowerDumpService:
    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great-circle distance between two points in km."""
        r = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    @staticmethod
    def analyze_tower_dump(
        db: Session,
        case_id: str,
        tower_ids: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        center_lat: Optional[float] = None,
        center_lon: Optional[float] = None,
        radius_km: float = 2.0
    ) -> Dict[str, Any]:
        query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)

        if start_time:
            query = query.filter(CDRRecord.timestamp >= start_time)
        if end_time:
            query = query.filter(CDRRecord.timestamp <= end_time)

        records = query.all()

        # Filter by tower ids or geo-radius
        filtered_records = []
        for r in records:
            matched = False
            if tower_ids and r.cell_tower_id in tower_ids:
                matched = True
            elif center_lat is not None and center_lon is not None and r.latitude and r.longitude:
                dist = TowerDumpService.haversine_distance(center_lat, center_lon, r.latitude, r.longitude)
                if dist <= radius_km:
                    matched = True
            elif not tower_ids and center_lat is None:
                # Include all in case no spatial filter specified
                matched = True

            if matched:
                filtered_records.append(r)

        # Map by phone number (both callers and receivers)
        suspects: Dict[str, Dict[str, Any]] = {}
        target_towers = set(tower_ids) if tower_ids else set([r.cell_tower_id for r in filtered_records if r.cell_tower_id])

        for r in filtered_records:
            parties = [r.caller_number]
            if r.receiver_number:
                parties.append(r.receiver_number)

            for phone in parties:
                if phone not in suspects:
                    suspects[phone] = {
                        "phone_number": phone,
                        "hits": 0,
                        "towers": set(),
                        "timestamps": [],
                        "imeis": set(),
                        "call_types": set(),
                        "latitudes": [],
                        "longitudes": [],
                    }
                suspects[phone]["hits"] += 1
                if r.cell_tower_id:
                    suspects[phone]["towers"].add(r.cell_tower_id)
                suspects[phone]["timestamps"].append(r.timestamp.isoformat())
                if r.imei:
                    suspects[phone]["imeis"].add(r.imei)
                if r.call_type:
                    suspects[phone]["call_types"].add(r.call_type)
                if r.latitude and r.longitude:
                    suspects[phone]["latitudes"].append(r.latitude)
                    suspects[phone]["longitudes"].append(r.longitude)

        # Calculate intersection score and ranking
        results = []
        total_unique_towers = len(target_towers) if target_towers else 1

        for phone, data in suspects.items():
            unique_towers_visited = len(data["towers"])
            # Co-presence score: based on tower diversity & frequency
            score = round((unique_towers_visited / max(1, total_unique_towers)) * 0.7 + min(1.0, data["hits"] / 20.0) * 0.3, 3)

            results.append({
                "phone_number": phone,
                "tower_hits": data["hits"],
                "unique_towers_count": unique_towers_visited,
                "matching_towers": list(data["towers"]),
                "first_seen": min(data["timestamps"]) if data["timestamps"] else None,
                "last_seen": max(data["timestamps"]) if data["timestamps"] else None,
                "imeis": list(data["imeis"]),
                "call_types": list(data["call_types"]),
                "co_presence_score": score,
                "is_multi_tower_intersect": unique_towers_visited > 1,
            })

        # Sort by co-presence score descending
        results.sort(key=lambda x: (x["unique_towers_count"], x["tower_hits"], x["co_presence_score"]), reverse=True)

        return {
            "case_id": case_id,
            "total_records_analyzed": len(filtered_records),
            "unique_numbers_found": len(suspects),
            "target_towers": list(target_towers),
            "intersection_matches": results[:200]
        }
