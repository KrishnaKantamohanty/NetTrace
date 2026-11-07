from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from app.models.postgres_models import CDRRecord

class TimelineAnalyticsService:
    @staticmethod
    def get_frequency_matrix(db: Session, case_id: str, caller_filter: Optional[str] = None) -> Dict[str, Any]:
        query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)
        if caller_filter:
            query = query.filter((CDRRecord.caller_number == caller_filter) | (CDRRecord.receiver_number == caller_filter))

        records = query.all()

        # 24-hour distribution bucket
        hourly_stats = {h: {"hour": h, "total": 0, "voice": 0, "sms": 0, "data": 0, "duration_minutes": 0.0} for h in range(24)}
        daily_stats: Dict[str, Dict[str, Any]] = {}
        late_night_calls = []

        total_duration = 0
        total_calls = len(records)

        for r in records:
            dt = r.timestamp
            h = dt.hour
            d_str = dt.strftime("%Y-%m-%d")

            hourly_stats[h]["total"] += 1
            if r.call_type == "VOICE":
                hourly_stats[h]["voice"] += 1
            elif r.call_type == "SMS":
                hourly_stats[h]["sms"] += 1
            elif r.call_type == "DATA":
                hourly_stats[h]["data"] += 1
            
            hourly_stats[h]["duration_minutes"] += round((r.duration_seconds or 0) / 60.0, 2)
            total_duration += (r.duration_seconds or 0)

            if d_str not in daily_stats:
                daily_stats[d_str] = {"date": d_str, "total": 0, "voice": 0, "sms": 0, "duration_minutes": 0.0}
            daily_stats[d_str]["total"] += 1
            if r.call_type == "VOICE":
                daily_stats[d_str]["voice"] += 1
            elif r.call_type == "SMS":
                daily_stats[d_str]["sms"] += 1
            daily_stats[d_str]["duration_minutes"] += round((r.duration_seconds or 0) / 60.0, 2)

            # Late night check: 12 AM (0:00) to 4 AM (3:59:59)
            if 0 <= h < 4:
                late_night_calls.append({
                    "id": r.id,
                    "caller": r.caller_number,
                    "receiver": r.receiver_number,
                    "timestamp": r.timestamp.isoformat(),
                    "hour": h,
                    "duration_seconds": r.duration_seconds,
                    "call_type": r.call_type,
                    "cell_tower_id": r.cell_tower_id,
                    "imei": r.imei
                })

        sorted_daily = sorted(daily_stats.values(), key=lambda x: x["date"])
        hourly_list = [hourly_stats[h] for h in range(24)]

        return {
            "case_id": case_id,
            "total_records": total_calls,
            "total_duration_minutes": round(total_duration / 60.0, 2),
            "late_night_count": len(late_night_calls),
            "hourly_matrix": hourly_list,
            "daily_trends": sorted_daily,
            "late_night_records": late_night_calls[:100], # top 100 for inspection
        }
