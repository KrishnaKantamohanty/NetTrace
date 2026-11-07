import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.postgres_models import GeofenceRule, CDRRecord

class GeofenceService:
    @staticmethod
    def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Great circle distance in meters."""
        r = 6371000.0 # Earth radius in meters
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    @staticmethod
    def get_rules_for_case(db: Session, case_id: str) -> List[Dict[str, Any]]:
        rules = db.query(GeofenceRule).filter(GeofenceRule.case_id == case_id).all()
        if not rules:
            # Seed default high-security Delhi perimeters
            default_fences = [
                GeofenceRule(
                    case_id=case_id,
                    fence_name="IGI Airport Cargo & Terminal 3 Perimeter",
                    center_lat=28.5562,
                    center_lng=77.1000,
                    radius_meters=2500.0,
                    color="#f43f5e"
                ),
                GeofenceRule(
                    case_id=case_id,
                    fence_name="Rohini Hawala Safehouse Cluster",
                    center_lat=28.7159,
                    center_lng=77.1130,
                    radius_meters=1800.0,
                    color="#f59e0b"
                ),
                GeofenceRule(
                    case_id=case_id,
                    fence_name="Delhi-Haryana Border Transit Gate",
                    center_lat=28.6500,
                    center_lng=77.0300,
                    radius_meters=2000.0,
                    color="#06b6d4"
                )
            ]
            db.add_all(default_fences)
            db.commit()
            rules = db.query(GeofenceRule).filter(GeofenceRule.case_id == case_id).all()

        results = []
        for r in rules:
            results.append({
                "id": r.id,
                "case_id": r.case_id,
                "name": r.fence_name,
                "center_lat": r.center_lat,
                "center_lng": r.center_lng,
                "radius_meters": r.radius_meters,
                "color": r.color,
                "breach_count": r.breach_count,
            })
        return results

    @staticmethod
    def check_geofence_breaches(db: Session, case_id: str) -> List[Dict[str, Any]]:
        """Scans all CDR records against active geofences to detect border/safehouse violations."""
        rules = db.query(GeofenceRule).filter(GeofenceRule.case_id == case_id).all()
        records = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id,
            CDRRecord.latitude.isnot(None),
            CDRRecord.longitude.isnot(None)
        ).all()

        breaches = []
        rule_breach_counts = {r.id: 0 for r in rules}

        for rec in records:
            for rule in rules:
                dist = GeofenceService.haversine_meters(
                    rule.center_lat, rule.center_lng,
                    rec.latitude, rec.longitude
                )
                if dist <= rule.radius_meters:
                    rule_breach_counts[rule.id] += 1
                    breaches.append({
                        "breach_id": f"BRCH-{len(breaches)+1:03d}",
                        "fence_name": rule.fence_name,
                        "fence_id": rule.id,
                        "subscriber": rec.caller_number,
                        "counterpart": rec.receiver_number,
                        "timestamp": rec.timestamp.isoformat(),
                        "distance_from_center_meters": round(dist, 1),
                        "tower_id": rec.cell_tower_id,
                        "imei": rec.imei,
                        "call_type": rec.call_type
                    })

        # Update breach counts on rules
        for rule in rules:
            rule.breach_count = rule_breach_counts.get(rule.id, 0)
        db.commit()

        # Sort by most recent breach
        breaches.sort(key=lambda x: x["timestamp"], reverse=True)
        return breaches[:50]
