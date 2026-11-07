from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.postgres_models import IPDRRecord, TelemetryRecord

class IPDRAnalyticsService:
    @staticmethod
    def get_ipdr_summary(db: Session, case_id: str) -> Dict[str, Any]:
        records = db.query(IPDRRecord).filter(IPDRRecord.case_id == case_id).all()
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.case_id == case_id).all()

        total_sessions = len(records)
        total_upload_bytes = sum(r.bytes_uploaded or 0 for r in records)
        total_download_bytes = sum(r.bytes_downloaded or 0 for r in records)

        # App Protocol distribution
        protocol_breakdown: Dict[str, Dict[str, Any]] = {}
        for r in records:
            p = r.app_protocol or "Other"
            if p not in protocol_breakdown:
                protocol_breakdown[p] = {"protocol": p, "count": 0, "total_bytes": 0}
            protocol_breakdown[p]["count"] += 1
            protocol_breakdown[p]["total_bytes"] += (r.bytes_uploaded or 0) + (r.bytes_downloaded or 0)

        # High data consumption suspects (potential encrypted VoIP calls / large file transfers)
        suspect_data: Dict[str, Dict[str, Any]] = {}
        for r in records:
            m = r.msisdn
            if m not in suspect_data:
                suspect_data[m] = {
                    "msisdn": m,
                    "session_count": 0,
                    "total_mb": 0.0,
                    "protocols": set(),
                    "dest_ips": set(),
                }
            suspect_data[m]["session_count"] += 1
            suspect_data[m]["total_mb"] += round(((r.bytes_uploaded or 0) + (r.bytes_downloaded or 0)) / (1024 * 1024), 2)
            suspect_data[m]["protocols"].add(r.app_protocol)
            suspect_data[m]["dest_ips"].add(r.dest_ip)

        ranked_suspects = []
        for s in suspect_data.values():
            ranked_suspects.append({
                "msisdn": s["msisdn"],
                "session_count": s["session_count"],
                "total_mb": round(s["total_mb"], 2),
                "protocols": list(s["protocols"]),
                "unique_dest_ips": len(s["dest_ips"]),
            })
        ranked_suspects.sort(key=lambda x: x["total_mb"], reverse=True)

        # Telemetry anomaly events (e.g. Flight Mode, Shutdowns, Low Battery)
        telemetry_events = []
        for t in telemetry:
            telemetry_events.append({
                "id": t.id,
                "msisdn": t.msisdn,
                "imei": t.imei,
                "event_type": t.event_type,
                "battery_level": t.battery_level,
                "timestamp": t.timestamp.isoformat(),
                "cell_tower_id": t.cell_tower_id,
                "signal_dbm": t.signal_strength_dbm,
                "notes": t.notes or ""
            })

        return {
            "case_id": case_id,
            "total_ipdr_sessions": total_sessions,
            "total_data_gb": round((total_upload_bytes + total_download_bytes) / (1024 * 1024 * 1024), 3),
            "protocol_breakdown": list(protocol_breakdown.values()),
            "top_data_suspects": ranked_suspects[:15],
            "telemetry_events_count": len(telemetry),
            "telemetry_log": telemetry_events[:50],
            "raw_ipdr_sample": [
                {
                    "id": r.id,
                    "msisdn": r.msisdn,
                    "source_ip": f"{r.source_ip}:{r.source_port or 0}",
                    "dest_ip": f"{r.dest_ip}:{r.dest_port or 0}",
                    "protocol": r.app_protocol,
                    "duration": r.duration_seconds,
                    "upload_kb": round((r.bytes_uploaded or 0) / 1024, 1),
                    "download_kb": round((r.bytes_downloaded or 0) / 1024, 1),
                    "start_time": r.session_start.isoformat(),
                    "tower": r.cell_tower_id or "N/A"
                }
                for r in records[:50]
            ]
        }
