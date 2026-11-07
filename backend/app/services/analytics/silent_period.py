import math
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.postgres_models import CDRRecord

class SilentPeriodService:
    @staticmethod
    def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
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
    def detect_silent_periods(
        db: Session,
        case_id: str,
        target_msisdn: Optional[str] = None,
        min_gap_hours: float = 3.0,
        crime_start: Optional[datetime] = None,
        crime_end: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Detects silent / dormant inactivity windows for target MSISDNs.
        Flags potential device switch-off, flight mode, or radio silence around critical incident windows.
        """
        # Determine target list
        if target_msisdn:
            targets = [target_msisdn]
        else:
            # Query top 5 most frequent callers in this case
            top_records = db.query(CDRRecord.caller_number).filter(
                CDRRecord.case_id == case_id
            ).all()
            from collections import Counter
            counts = Counter([r[0] for r in top_records if r[0] and len(r[0]) >= 10])
            targets = [phone for phone, _ in counts.most_common(5)]

        all_silence_alerts = []

        for target in targets:
            records = db.query(CDRRecord).filter(
                CDRRecord.case_id == case_id,
                or_(CDRRecord.caller_number == target, CDRRecord.receiver_number == target)
            ).order_by(CDRRecord.timestamp.asc()).all()

            if len(records) < 2:
                continue

            for i in range(len(records) - 1):
                prev_ev = records[i]
                next_ev = records[i + 1]

                gap_seconds = (next_ev.timestamp - prev_ev.timestamp).total_seconds()
                gap_hours = gap_seconds / 3600.0

                if gap_hours >= min_gap_hours:
                    # Calculate physical displacement between silence onset and reappearance
                    displacement_km = None
                    if prev_ev.latitude and prev_ev.longitude and next_ev.latitude and next_ev.longitude:
                        displacement_km = round(
                            SilentPeriodService._haversine_distance_km(
                                prev_ev.latitude, prev_ev.longitude, next_ev.latitude, next_ev.longitude
                            ), 2
                        )

                    # Assess crime window overlap
                    overlaps_crime = False
                    if crime_start and crime_end:
                        if (prev_ev.timestamp <= crime_end) and (next_ev.timestamp >= crime_start):
                            overlaps_crime = True

                    # Determine suspicion score & severity level
                    suspicion_reasons = []
                    severity = "MODERATE"
                    score = 40

                    if overlaps_crime:
                        severity = "CRITICAL"
                        score = 95
                        suspicion_reasons.append("Inactive during designated crime occurrence window")

                    if displacement_km and displacement_km > 50.0:
                        score = min(100, score + 30)
                        severity = "HIGH" if severity != "CRITICAL" else "CRITICAL"
                        suspicion_reasons.append(f"Significant physical displacement during silence ({displacement_km} km)")

                    # Check if switch off happened late night / early morning
                    prev_hour = prev_ev.timestamp.hour
                    next_hour = next_ev.timestamp.hour
                    if (22 <= prev_hour or prev_hour <= 4) and (5 <= next_hour <= 10):
                        suspicion_reasons.append("Off-hours radio silence pattern (Late-night to Morning)")
                        score = min(100, score + 15)

                    if gap_hours >= 24.0:
                        suspicion_reasons.append(f"Prolonged blackout duration ({round(gap_hours, 1)} hrs)")
                        score = min(100, score + 20)

                    if not suspicion_reasons:
                        suspicion_reasons.append(f"Activity blackout exceeding {min_gap_hours} hours threshold")

                    all_silence_alerts.append({
                        "target_msisdn": target,
                        "gap_start": prev_ev.timestamp.isoformat(),
                        "gap_end": next_ev.timestamp.isoformat(),
                        "gap_duration_hours": round(gap_hours, 2),
                        "gap_duration_formatted": f"{int(gap_hours)}h {int((gap_hours % 1) * 60)}m",
                        "last_known_event": {
                            "timestamp": prev_ev.timestamp.isoformat(),
                            "tower_id": prev_ev.cell_tower_id or "UNKNOWN",
                            "latitude": prev_ev.latitude,
                            "longitude": prev_ev.longitude,
                            "call_type": prev_ev.call_type,
                            "imei": prev_ev.imei
                        },
                        "reappearance_event": {
                            "timestamp": next_ev.timestamp.isoformat(),
                            "tower_id": next_ev.cell_tower_id or "UNKNOWN",
                            "latitude": next_ev.latitude,
                            "longitude": next_ev.longitude,
                            "call_type": next_ev.call_type,
                            "imei": next_ev.imei
                        },
                        "displacement_km": displacement_km,
                        "overlaps_crime_window": overlaps_crime,
                        "suspicion_score": score,
                        "severity": severity,
                        "suspicion_reasons": suspicion_reasons
                    })

        all_silence_alerts.sort(key=lambda x: (x["suspicion_score"], x["gap_duration_hours"]), reverse=True)

        return {
            "case_id": case_id,
            "target_analyzed": target_msisdn or "All Key Suspects",
            "min_gap_hours_threshold": min_gap_hours,
            "total_silent_periods_detected": len(all_silence_alerts),
            "critical_alerts_count": len([a for a in all_silence_alerts if a["severity"] == "CRITICAL"]),
            "silent_periods": all_silence_alerts
        }
