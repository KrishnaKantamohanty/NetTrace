import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc
from app.models.postgres_models import CDRRecord

def format_duration_hms(seconds: int) -> str:
    """Formats integer seconds into HH:MM:SS format."""
    if not seconds or seconds < 0:
        return "00:00:00"
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"

class PartyAnalysisService:
    @staticmethod
    def get_party_call_analysis(
        db: Session,
        case_id: str,
        party_a: Optional[str] = None,
        party_b: Optional[str] = None,
        direction: Optional[str] = None, # 'A_TO_B', 'B_TO_A', 'ALL'
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        call_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Comprehensive communication analysis between Party A and Party B.
        Tracks directional interaction (Party A -> Party B vs Party B -> Party A).
        """
        # Base query for case
        base_query = db.query(CDRRecord).filter(CDRRecord.case_id == case_id)

        clean_a = party_a.strip() if party_a else None
        clean_b = party_b.strip() if party_b else None

        # Filter by parties
        if clean_a and clean_b:
            if direction == "A_TO_B":
                base_query = base_query.filter(
                    CDRRecord.caller_number == clean_a,
                    CDRRecord.receiver_number == clean_b
                )
            elif direction == "B_TO_A":
                base_query = base_query.filter(
                    CDRRecord.caller_number == clean_b,
                    CDRRecord.receiver_number == clean_a
                )
            else:
                base_query = base_query.filter(
                    or_(
                        and_(CDRRecord.caller_number == clean_a, CDRRecord.receiver_number == clean_b),
                        and_(CDRRecord.caller_number == clean_b, CDRRecord.receiver_number == clean_a)
                    )
                )
        elif clean_a:
            base_query = base_query.filter(
                or_(CDRRecord.caller_number == clean_a, CDRRecord.receiver_number == clean_a)
            )
        elif clean_b:
            base_query = base_query.filter(
                or_(CDRRecord.caller_number == clean_b, CDRRecord.receiver_number == clean_b)
            )

        # Filters: Date range
        if start_date:
            base_query = base_query.filter(CDRRecord.timestamp >= start_date)
        if end_date:
            base_query = base_query.filter(CDRRecord.timestamp <= end_date)

        # Filters: Duration range
        if min_duration is not None:
            base_query = base_query.filter(CDRRecord.duration_seconds >= min_duration)
        if max_duration is not None:
            base_query = base_query.filter(CDRRecord.duration_seconds <= max_duration)

        # Filters: Call type
        if call_type and call_type.upper() != "ALL":
            base_query = base_query.filter(CDRRecord.call_type.ilike(f"%{call_type.strip()}%"))

        all_records = base_query.order_by(CDRRecord.timestamp.asc()).all()

        total_count = len(all_records)
        if total_count == 0:
            return {
                "case_id": case_id,
                "party_a": clean_a,
                "party_b": clean_b,
                "total_calls_between_parties": 0,
                "total_talking_time_seconds": 0,
                "total_talking_time_formatted": "00:00:00",
                "summary": {
                    "a_to_b_calls": 0,
                    "b_to_a_calls": 0,
                    "a_to_b_duration": 0,
                    "b_to_a_duration": 0,
                    "first_communication": None,
                    "last_communication": None,
                    "dominant_caller": None,
                    "direction_arrow": "N/A"
                },
                "most_frequent_contacts": [],
                "records": []
            }

        # Calculate directional communication summary
        a_to_b_count = 0
        b_to_a_count = 0
        a_to_b_dur = 0
        b_to_a_dur = 0
        other_interactions = 0
        total_dur = 0

        first_ts = all_records[0].timestamp.isoformat()
        last_ts = all_records[-1].timestamp.isoformat()

        # Contact frequency distribution
        contact_counter = {}

        record_list = []
        for r in all_records:
            caller = r.caller_number or "UNKNOWN"
            receiver = r.receiver_number or "UNKNOWN"
            dur = r.duration_seconds or 0
            total_dur += dur

            # Direction determination
            if clean_a and clean_b:
                if caller == clean_a and receiver == clean_b:
                    a_to_b_count += 1
                    a_to_b_dur += dur
                    dir_tag = "Party A → Party B"
                    arrow = "→"
                elif caller == clean_b and receiver == clean_a:
                    b_to_a_count += 1
                    b_to_a_dur += dur
                    dir_tag = "Party B → Party A"
                    arrow = "←"
                else:
                    dir_tag = f"{caller} → {receiver}"
                    arrow = "→"
            elif clean_a:
                peer = receiver if caller == clean_a else caller
                contact_counter[peer] = contact_counter.get(peer, 0) + 1
                if caller == clean_a:
                    a_to_b_count += 1
                    a_to_b_dur += dur
                    dir_tag = "Outgoing (Party A → Peer)"
                    arrow = "→"
                else:
                    b_to_a_count += 1
                    b_to_a_dur += dur
                    dir_tag = "Incoming (Peer → Party A)"
                    arrow = "←"
            else:
                contact_counter[caller] = contact_counter.get(caller, 0) + 1
                contact_counter[receiver] = contact_counter.get(receiver, 0) + 1
                dir_tag = f"{caller} → {receiver}"
                arrow = "→"

            dir_indicator = "A_TO_B" if (clean_a and caller == clean_a) else ("B_TO_A" if (clean_b and caller == clean_b) else "OTHER")

            record_list.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "caller_a": caller,
                "receiver_b": receiver,
                "caller_msisdn": caller,
                "receiver_msisdn": receiver,
                "direction_indicator": dir_indicator,
                "direction_tag": dir_tag,
                "arrow": arrow,
                "duration": dur,
                "duration_seconds": dur,
                "duration_formatted": format_duration_hms(dur),
                "formatted_duration": format_duration_hms(dur),
                "call_type": r.call_type or "VOICE",
                "tower_id": r.cell_tower_id or "UNKNOWN",
                "latitude": r.latitude,
                "longitude": r.longitude,
                "imei": r.imei or "-",
                "imsi": r.imsi or "-",
                "operator": r.operator or "-"
            })

        # Determine dominant direction
        if a_to_b_count > b_to_a_count:
            dominant = clean_a or "Party A"
            dir_arrow_summary = "Party A → Party B (Dominant Outgoing)"
        elif b_to_a_count > a_to_b_count:
            dominant = clean_b or "Party B"
            dir_arrow_summary = "Party B → Party A (Dominant Incoming)"
        elif a_to_b_count == b_to_a_count and a_to_b_count > 0:
            dominant = "Equal Bidirectional"
            dir_arrow_summary = "Party A ⇄ Party B (Balanced Interaction)"
        else:
            dominant = "Indeterminate"
            dir_arrow_summary = "Party A ⇄ Party B"

        # Most frequent contacts
        sorted_contacts = sorted(contact_counter.items(), key=lambda x: x[1], reverse=True)[:10]
        most_frequent = [{"contact_number": num, "total_calls": cnt} for num, cnt in sorted_contacts]

        # Pagination
        start_idx = (page - 1) * page_size
        paginated_records = record_list[start_idx: start_idx + page_size]

        return {
            "case_id": case_id,
            "party_a": clean_a,
            "party_b": clean_b,
            "total_calls_between_parties": total_count,
            "total_talking_time_seconds": total_dur,
            "total_talking_time_formatted": format_duration_hms(total_dur),
            "pair_summary": {
                "party_a": clean_a or "",
                "party_b": clean_b or "",
                "total_calls": total_count,
                "a_to_b_count": a_to_b_count,
                "b_to_a_count": b_to_a_count,
                "total_duration": total_dur,
                "formatted_total_duration": format_duration_hms(total_dur),
                "first_communication": first_ts,
                "last_communication": last_ts
            },
            "summary": {
                "a_to_b_calls": a_to_b_count,
                "b_to_a_calls": b_to_a_count,
                "a_to_b_duration": a_to_b_dur,
                "b_to_a_duration": b_to_a_dur,
                "a_to_b_duration_formatted": format_duration_hms(a_to_b_dur),
                "b_to_a_duration_formatted": format_duration_hms(b_to_a_dur),
                "first_communication": first_ts,
                "last_communication": last_ts,
                "dominant_caller": dominant,
                "direction_arrow": dir_arrow_summary
            },
            "most_frequent_contacts": most_frequent,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_records": total_count,
                "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1
            },
            "records": paginated_records
        }

