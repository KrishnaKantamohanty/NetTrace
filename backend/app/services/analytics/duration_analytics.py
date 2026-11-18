from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.postgres_models import CDRRecord

def format_duration_hms(seconds: int) -> str:
    """Formats integer seconds into HH:MM:SS format."""
    if not seconds or seconds < 0:
        return "00:00:00"
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"

class DurationAnalyticsService:
    @staticmethod
    def get_duration_analytics(
        db: Session,
        case_id: str,
        target_party: Optional[str] = None,
        peer_party: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        call_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Deep call duration analytics, talking time aggregations, daily/monthly histograms,
        and call duration distribution breakdowns.
        """
        query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)

        clean_target = target_party.strip() if target_party else None
        clean_peer = peer_party.strip() if peer_party else None

        if clean_target and clean_peer:
            query = query.filter(
                or_(
                    and_(CDRRecord.caller_number == clean_target, CDRRecord.receiver_number == clean_peer),
                    and_(CDRRecord.caller_number == clean_peer, CDRRecord.receiver_number == clean_target)
                )
            )
        elif clean_target:
            query = query.filter(
                or_(CDRRecord.caller_number == clean_target, CDRRecord.receiver_number == clean_target)
            )
        elif clean_peer:
            query = query.filter(
                or_(CDRRecord.caller_number == clean_peer, CDRRecord.receiver_number == clean_peer)
            )

        if start_date:
            query = query.filter(CDRRecord.timestamp >= start_date)
        if end_date:
            query = query.filter(CDRRecord.timestamp <= end_date)

        if min_duration is not None:
            query = query.filter(CDRRecord.duration_seconds >= min_duration)
        if max_duration is not None:
            query = query.filter(CDRRecord.duration_seconds <= max_duration)

        if call_type and call_type.upper() != "ALL":
            query = query.filter(CDRRecord.call_type.ilike(f"%{call_type.strip()}%"))

        records = query.order_by(CDRRecord.timestamp.asc()).all()

        if not records:
            return {
                "case_id": case_id,
                "target_party": clean_target,
                "peer_party": clean_peer,
                "metrics": {
                    "total_calls": 0,
                    "total_duration_seconds": 0,
                    "total_duration_formatted": "00:00:00",
                    "average_duration_seconds": 0,
                    "average_duration_formatted": "00:00:00",
                    "longest_call_seconds": 0,
                    "longest_call_formatted": "00:00:00",
                    "shortest_call_seconds": 0,
                    "shortest_call_formatted": "00:00:00",
                    "zero_duration_calls_count": 0,
                    "incoming_talking_seconds": 0,
                    "incoming_talking_formatted": "00:00:00",
                    "outgoing_talking_seconds": 0,
                    "outgoing_talking_formatted": "00:00:00",
                },
                "duration_brackets": {},
                "daily_trend": [],
                "monthly_trend": [],
                "pagination": {"page": 1, "page_size": page_size, "total_records": 0, "total_pages": 0},
                "call_history": []
            }

        total_seconds = 0
        durations = []
        zero_duration_count = 0
        incoming_seconds = 0
        outgoing_seconds = 0

        # Duration buckets: 0s (missed/rejected), 1-30s, 31-120s, 2-10m, >10m
        brackets = {
            "Zero Duration (0s)": 0,
            "Short Burst (1-30s)": 0,
            "Standard (31-120s)": 0,
            "Prolonged (2-10m)": 0,
            "Extended (>10m)": 0,
            "zero_duration": 0,
            "under_1_min": 0,
            "1_to_5_min": 0,
            "5_to_15_min": 0,
            "15_to_30_min": 0,
            "over_30_min": 0
        }

        daily_data = defaultdict(lambda: {"duration": 0, "calls": 0, "incoming": 0, "outgoing": 0})
        monthly_data = defaultdict(lambda: {"duration": 0, "calls": 0})

        call_rows = []
        longest_rec = None
        shortest_non_zero_rec = None
        min_non_zero = float("inf")
        max_duration_seen = 0

        for r in records:
            dur = r.duration_seconds or 0
            total_seconds += dur
            durations.append(dur)

            # Determine direction relative to target
            is_outgoing = True
            if clean_target:
                is_outgoing = (r.caller_number == clean_target)

            if is_outgoing:
                outgoing_seconds += dur
            else:
                incoming_seconds += dur

            if dur == 0:
                zero_duration_count += 1
                brackets["Zero Duration (0s)"] += 1
                brackets["zero_duration"] += 1
            elif dur <= 30:
                brackets["Short Burst (1-30s)"] += 1
                brackets["under_1_min"] += 1
            elif dur <= 60:
                brackets["under_1_min"] += 1
                brackets["Standard (31-120s)"] += 1
            elif dur <= 300:
                brackets["1_to_5_min"] += 1
                if dur <= 120:
                    brackets["Standard (31-120s)"] += 1
                else:
                    brackets["Prolonged (2-10m)"] += 1
            elif dur <= 600:
                brackets["5_to_15_min"] += 1
                brackets["Prolonged (2-10m)"] += 1
            elif dur <= 900:
                brackets["5_to_15_min"] += 1
                brackets["Extended (>10m)"] += 1
            elif dur <= 1800:
                brackets["15_to_30_min"] += 1
                brackets["Extended (>10m)"] += 1
            else:
                brackets["over_30_min"] += 1
                brackets["Extended (>10m)"] += 1

            if dur > max_duration_seen:
                max_duration_seen = dur
                longest_rec = r

            if 0 < dur < min_non_zero:
                min_non_zero = dur
                shortest_non_zero_rec = r

            # Daily grouping
            day_key = r.timestamp.strftime("%Y-%m-%d")
            daily_data[day_key]["duration"] += dur
            daily_data[day_key]["calls"] += 1
            if is_outgoing:
                daily_data[day_key]["outgoing"] += dur
            else:
                daily_data[day_key]["incoming"] += dur

            # Monthly grouping
            month_key = r.timestamp.strftime("%Y-%m")
            monthly_data[month_key]["duration"] += dur
            monthly_data[month_key]["calls"] += 1

            call_rows.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "caller": r.caller_number,
                "receiver": r.receiver_number,
                "direction": "OUTGOING" if is_outgoing else "INCOMING",
                "duration_seconds": dur,
                "duration_formatted": format_duration_hms(dur),
                "call_type": r.call_type or "VOICE",
                "tower_id": r.cell_tower_id or "UNKNOWN",
                "imei": r.imei or "-",
                "operator": r.operator or "-"
            })

        avg_dur = int(total_seconds / len(records)) if records else 0
        shortest_dur = min_non_zero if min_non_zero != float("inf") else 0

        # Build sorted daily trend list
        sorted_daily = []
        for day in sorted(daily_data.keys()):
            d_val = daily_data[day]
            sorted_daily.append({
                "date": day,
                "total_duration_seconds": d_val["duration"],
                "total_duration_formatted": format_duration_hms(d_val["duration"]),
                "call_count": d_val["calls"],
                "incoming_seconds": d_val["incoming"],
                "outgoing_seconds": d_val["outgoing"],
                "avg_duration_seconds": int(d_val["duration"] / d_val["calls"]) if d_val["calls"] else 0
            })

        sorted_monthly = []
        for m in sorted(monthly_data.keys()):
            m_val = monthly_data[m]
            sorted_monthly.append({
                "month": m,
                "total_duration_seconds": m_val["duration"],
                "total_duration_formatted": format_duration_hms(m_val["duration"]),
                "call_count": m_val["calls"]
            })

        # Pagination
        start_idx = (page - 1) * page_size
        paginated_rows = call_rows[start_idx: start_idx + page_size]

        metrics_dict = {
            "total_calls": len(records),
            "total_calls_analyzed": len(records),
            "total_duration_seconds": total_seconds,
            "total_talking_time_seconds": total_seconds,
            "total_duration_formatted": format_duration_hms(total_seconds),
            "formatted_total_talking_time": format_duration_hms(total_seconds),
            "average_duration_seconds": avg_dur,
            "average_call_duration_seconds": avg_dur,
            "average_duration_formatted": format_duration_hms(avg_dur),
            "formatted_average_duration": format_duration_hms(avg_dur),
            "longest_call_seconds": max_duration_seen,
            "longest_call_formatted": format_duration_hms(max_duration_seen),
            "formatted_longest_call": format_duration_hms(max_duration_seen),
            "longest_call_details": {
                "timestamp": longest_rec.timestamp.isoformat() if longest_rec else None,
                "caller": longest_rec.caller_number if longest_rec else None,
                "receiver": longest_rec.receiver_number if longest_rec else None
            } if longest_rec else None,
            "shortest_call_seconds": shortest_dur,
            "shortest_call_formatted": format_duration_hms(shortest_dur),
            "formatted_shortest_call": format_duration_hms(shortest_dur),
            "zero_duration_calls": zero_duration_count,
            "zero_duration_calls_count": zero_duration_count,
            "incoming_talking_seconds": incoming_seconds,
            "incoming_talking_formatted": format_duration_hms(incoming_seconds),
            "formatted_incoming_talking_time": format_duration_hms(incoming_seconds),
            "outgoing_talking_seconds": outgoing_seconds,
            "outgoing_talking_formatted": format_duration_hms(outgoing_seconds),
            "formatted_outgoing_talking_time": format_duration_hms(outgoing_seconds),
        }

        return {
            "case_id": case_id,
            "target_party": clean_target,
            "peer_party": clean_peer,
            "metrics": metrics_dict,
            "overall_metrics": metrics_dict,
            "duration_brackets": brackets,
            "duration_distribution": brackets,
            "daily_trend": sorted_daily,
            "monthly_trend": sorted_monthly,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_records": len(call_rows),
                "total_pages": (len(call_rows) + page_size - 1) // page_size if page_size > 0 else 1
            },
            "call_history": paginated_rows
        }

