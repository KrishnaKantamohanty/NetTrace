from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict, Counter
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.models.postgres_models import CDRRecord, CaseMetadata
from app.services.graph.graph_builder import GraphBuilder
from app.services.graph.centrality import CentralityAnalysisService
from app.services.graph.link_finder import LinkFinderService
from app.services.gis.co_traveler import CoTravelerService
from app.services.analytics.silent_period import SilentPeriodService
from app.services.analytics.imei_sim_timeline import IMEISIMTimelineService
from app.services.osint.enrichment import OSINTEnrichmentService
from app.services.analytics.party_analysis import format_duration_hms

class DeepInvestigationService:
    @staticmethod
    def run_investigation(
        db: Session,
        case_id: str,
        target_phone: str,
        secondary_phone: Optional[str] = None,
        direction: Optional[str] = None, # 'INCOMING', 'OUTGOING', 'ALL'
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        tower_id: Optional[str] = None,
        imei: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Comprehensive Deep Investigation Workspace for a specific target number.
        Consolidates graph, duration, geo-spatial, hardware, silent period,
        and OSINT intelligence into an evidence-grounded profile.
        """
        clean_target = str(target_phone).strip()
        clean_secondary = str(secondary_phone).strip() if secondary_phone else None

        # 1. Base query for target's communications in this case
        query = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id,
            or_(CDRRecord.caller_number == clean_target, CDRRecord.receiver_number == clean_target)
        )

        if direction == "OUTGOING":
            query = query.filter(CDRRecord.caller_number == clean_target)
        elif direction == "INCOMING":
            query = query.filter(CDRRecord.receiver_number == clean_target)

        if start_date:
            query = query.filter(CDRRecord.timestamp >= start_date)
        if end_date:
            query = query.filter(CDRRecord.timestamp <= end_date)

        if min_duration is not None:
            query = query.filter(CDRRecord.duration_seconds >= min_duration)
        if max_duration is not None:
            query = query.filter(CDRRecord.duration_seconds <= max_duration)

        if tower_id and tower_id.strip():
            query = query.filter(CDRRecord.cell_tower_id.ilike(f"%{tower_id.strip()}%"))

        if imei and imei.strip():
            query = query.filter(CDRRecord.imei.ilike(f"%{imei.strip()}%"))

        records = query.order_by(CDRRecord.timestamp.asc()).all()

        total_records_count = len(records)
        data_quality_warnings = []

        if total_records_count == 0:
            data_quality_warnings.append(f"No CDR transactions found matching filters for target '{clean_target}'.")
            return {
                "case_id": case_id,
                "target_phone": clean_target,
                "secondary_phone": clean_secondary,
                "total_records": 0,
                "profile": None,
                "data_quality_warnings": data_quality_warnings,
                "top_contacts": [],
                "hourly_timeline": [0] * 24,
                "graph_intelligence": {},
                "location_intelligence": {},
                "hardware_intelligence": {},
                "silent_periods": [],
                "co_travelers": [],
                "hypotheses_and_anomalies": [],
                "source_records": []
            }

        # 2. Aggregations & Profile Statistics
        outgoing_calls = 0
        incoming_calls = 0
        outgoing_duration = 0
        incoming_duration = 0
        zero_duration_calls = 0
        late_night_calls = 0

        peers_counter = Counter()
        hourly_counts = [0] * 24
        imeis_seen = set()
        imsis_seen = set()
        towers_visited = Counter()
        coordinates_trail = []
        _tower_coords_map = {}  # authoritative: tower_id -> (lat, lng) from actual CDR data

        missing_coords_count = 0
        missing_imei_count = 0

        for r in records:
            dur = r.duration_seconds or 0
            is_out = (r.caller_number == clean_target)
            peer = r.receiver_number if is_out else r.caller_number

            if is_out:
                outgoing_calls += 1
                outgoing_duration += dur
            else:
                incoming_calls += 1
                incoming_duration += dur

            if dur == 0:
                zero_duration_calls += 1

            h = r.timestamp.hour
            hourly_counts[h] += 1
            if 0 <= h < 4:
                late_night_calls += 1

            peers_counter[peer] += 1

            if r.imei and r.imei not in ["-", "--", "---", "None"]:
                imeis_seen.add(r.imei)
            else:
                missing_imei_count += 1

            if r.imsi and r.imsi not in ["-", "--", "---", "None"]:
                imsis_seen.add(r.imsi)

            if r.cell_tower_id and r.cell_tower_id not in ["-", "--", "---", "None"]:
                towers_visited[r.cell_tower_id] += 1

            if r.latitude is not None and r.longitude is not None:
                # Record authoritative coordinates for this tower
                if r.cell_tower_id and r.cell_tower_id not in ["-", "--", "---", "None"]:
                    if r.cell_tower_id not in _tower_coords_map:
                        _tower_coords_map[r.cell_tower_id] = (r.latitude, r.longitude)
                coordinates_trail.append({
                    "timestamp": r.timestamp.isoformat(),
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "tower_id": r.cell_tower_id,
                    "call_type": r.call_type
                })
            else:
                missing_coords_count += 1

        total_dur = outgoing_duration + incoming_duration
        avg_dur = int(total_dur / total_records_count) if total_records_count > 0 else 0

        # Data quality checks
        if missing_coords_count > 0:
            pct = int((missing_coords_count / total_records_count) * 100)
            data_quality_warnings.append(f"{pct}% of transactions lack GPS/cell tower coordinates.")
        if missing_imei_count > 0:
            pct = int((missing_imei_count / total_records_count) * 100)
            data_quality_warnings.append(f"{pct}% of transactions do not specify device IMEI.")

        # 3. OSINT Enrichment
        osint_data = None
        try:
            osint_data = OSINTEnrichmentService.get_or_create_profile(db, clean_target)
        except Exception:
            pass

        # 4. Graph Network Intelligence
        graph_intel = {}
        try:
            G = GraphBuilder.build_networkx_graph(db, case_id)
            if clean_target in G:
                metrics = CentralityAnalysisService.calculate_metrics(G)
                graph_intel = {
                    "in_graph": True,
                    "degree": G.degree(clean_target),
                    "betweenness": round(metrics["betweenness"].get(clean_target, 0.0), 4),
                    "pagerank": round(metrics["pagerank"].get(clean_target, 0.0), 4),
                    "is_hub": clean_target in metrics.get("hubs", []),
                    "is_bridge": clean_target in metrics.get("bridges", []),
                    "neighbors_count": len(list(G.neighbors(clean_target))),
                    "neighbors": list(G.neighbors(clean_target))[:20]
                }
            else:
                graph_intel = {"in_graph": False, "neighbors_count": 0}

            # Optional Path & Common Contacts if secondary_phone is present
            if clean_secondary and clean_target in G and clean_secondary in G:
                common = LinkFinderService.find_common_contacts(G, [clean_target, clean_secondary])
                path = LinkFinderService.find_shortest_path(G, clean_target, clean_secondary)
                graph_intel["common_contacts_with_secondary"] = common
                graph_intel["shortest_path_to_secondary"] = path
        except Exception as ge:
            graph_intel["error"] = str(ge)

        # 5. Co-Travelers Analysis
        co_travelers_list = []
        try:
            ct_res = CoTravelerService.analyze_co_travelers(db, case_id, target_msisdn=clean_target)
            co_travelers_list = ct_res.get("co_travelers", [])
        except Exception:
            pass

        # 6. Silent Periods Detection
        silent_periods_list = []
        try:
            sp_res = SilentPeriodService.detect_silent_periods(db, case_id, target_msisdn=clean_target)
            silent_periods_list = sp_res.get("silent_periods", [])
        except Exception:
            pass

        # 7. Hardware & IMEI Timeline
        imei_timeline = []
        try:
            it_res = IMEISIMTimelineService.get_swap_timeline(db, case_id, target_filter=clean_target)
            imei_timeline = it_res.get("timeline", [])
        except Exception:
            pass

        # 8. Investigative Hypotheses & Anomaly Detection
        # Explicitly marked as investigative indicators / hypotheses, NOT criminal proof
        hypotheses = []

        if late_night_calls > 0:
            pct_late = int((late_night_calls / total_records_count) * 100)
            if pct_late >= 20:
                hypotheses.append({
                    "indicator": "High Off-Hours Communication Pattern",
                    "title": "High Off-Hours Communication Pattern",
                    "category": "TEMPORAL",
                    "severity": "ELEVATED",
                    "fact": f"{late_night_calls} of {total_records_count} calls ({pct_late}%) occurred between 12:00 AM and 04:00 AM.",
                    "observation": f"{late_night_calls} of {total_records_count} calls ({pct_late}%) occurred between 12:00 AM and 04:00 AM.",
                    "hypothesis": "Target routinely communicates during overnight hours, consistent with covert or international coordination.",
                    "actionable_lead": "Cross-reference target's sleep cycle and overseas contacts."
                })

        if len(imeis_seen) > 1:
            hypotheses.append({
                "indicator": "Multiple IMEI Hardware Rotations",
                "title": "Multiple IMEI Hardware Rotations",
                "category": "EQUIPMENT",
                "severity": "HIGH",
                "fact": f"SIM {clean_target} operated across {len(imeis_seen)} distinct physical handsets ({', '.join(list(imeis_seen)[:3])}).",
                "observation": f"SIM {clean_target} operated across {len(imeis_seen)} distinct physical handsets ({', '.join(list(imeis_seen)[:3])}).",
                "hypothesis": "Pattern indicates device swapping or use of burner handsets across operational phases.",
                "actionable_lead": "Subpoena handset purchase receipts and retail invoice records for detected IMEIs."
            })

        if graph_intel.get("is_bridge"):
            hypotheses.append({
                "indicator": "Communication Broker / Bridge Position",
                "title": "Communication Broker / Bridge Position",
                "category": "LINKAGE",
                "severity": "HIGH",
                "fact": f"High Betweenness Centrality ({graph_intel.get('betweenness')}) connects disparate clusters.",
                "observation": f"High Betweenness Centrality ({graph_intel.get('betweenness')}) connects disparate clusters.",
                "hypothesis": "Target acts as an intermediary or liaison connecting separate communication networks.",
                "actionable_lead": "Interrogate bridge role between suspect clusters."
            })

        if len(silent_periods_list) > 0:
            crit_silence = [s for s in silent_periods_list if s.get("severity") == "CRITICAL" or s.get("gap_duration_hours", 0) >= 12]
            if crit_silence:
                hypotheses.append({
                    "indicator": "Prolonged Radio Silence / Blackout Intervals",
                    "title": "Prolonged Radio Silence / Blackout Intervals",
                    "category": "ACTIVITY_GAP",
                    "severity": "MODERATE",
                    "fact": f"Detected {len(crit_silence)} extended periods of zero cellular activity exceeding 12 hours.",
                    "observation": f"Detected {len(crit_silence)} extended periods of zero cellular activity exceeding 12 hours.",
                    "hypothesis": "Possible flight mode, power-down during travel, or operational silence.",
                    "actionable_lead": "Check airline manifests and toll plaza timestamps for inactive window."
                })

        if co_travelers_list:
            top_ct = co_travelers_list[0]
            hypotheses.append({
                "indicator": "Co-Traveling Companion Correlated",
                "title": "Co-Traveling Companion Correlated",
                "category": "MOBILITY",
                "severity": "HIGH",
                "fact": f"Shared {top_ct['shared_tower_count']} cell towers in sequence with {top_ct['companion_msisdn']} within time delta.",
                "observation": f"Shared {top_ct['shared_tower_count']} cell towers in sequence with {top_ct['companion_msisdn']} within time delta.",
                "hypothesis": "High probability of joint physical movement or convoy escort.",
                "actionable_lead": "Conduct joint surveillance of companion MSISDN."
            })

        # Top 10 contacts
        top_contacts = [
            {"contact": peer, "total_calls": cnt, "is_frequent": cnt >= 5}
            for peer, cnt in peers_counter.most_common(10)
        ]

        # Top towers visited
        top_towers = [
            {"tower_id": tid, "hits": cnt}
            for tid, cnt in towers_visited.most_common(10)
        ]

        # 9. Source records pagination
        source_records_list = []
        for r in records:
            dur = r.duration_seconds or 0
            is_out = (r.caller_number == clean_target)
            source_records_list.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "caller": r.caller_number,
                "receiver": r.receiver_number,
                "direction": "OUTGOING" if is_out else "INCOMING",
                "duration_seconds": dur,
                "duration_formatted": format_duration_hms(dur),
                "call_type": r.call_type or "VOICE",
                "tower_id": r.cell_tower_id or "-",
                "latitude": r.latitude,
                "longitude": r.longitude,
                "imei": r.imei or "-",
                "operator": r.operator or "-"
            })

        start_idx = (page - 1) * page_size
        paginated_source = source_records_list[start_idx: start_idx + page_size]

        profile = {
            "target_phone": clean_target,
            "target_number": clean_target,
            "total_transactions": total_records_count,
            "total_calls": total_records_count,
            "outgoing_calls": outgoing_calls,
            "incoming_calls": incoming_calls,
            "outgoing_duration_seconds": outgoing_duration,
            "incoming_duration_seconds": incoming_duration,
            "total_duration_seconds": total_dur,
            "total_duration_formatted": format_duration_hms(total_dur),
            "formatted_duration": format_duration_hms(total_dur),
            "average_duration_seconds": avg_dur,
            "average_duration_formatted": format_duration_hms(avg_dur),
            "zero_duration_calls": zero_duration_calls,
            "late_night_calls": late_night_calls,
            "unique_contacts_count": len(peers_counter),
            "unique_interlocutors": len(peers_counter),
            "unique_imeis_count": len(imeis_seen),
            "unique_imeis": len(imeis_seen),
            "imeis_list": list(imeis_seen),
            "unique_towers_count": len(towers_visited),
            "unique_towers": len(towers_visited),
            "first_seen": records[0].timestamp.isoformat(),
            "last_seen": records[-1].timestamp.isoformat(),
            "osint": osint_data
        }

        raw_common = graph_intel.get("common_contacts_with_secondary", [])
        common_contacts_list = [c["common_contact"] for c in raw_common] if isinstance(raw_common, list) else []

        raw_path = graph_intel.get("shortest_path_to_secondary", {})
        shortest_path_list = raw_path.get("path") if isinstance(raw_path, dict) and raw_path.get("found") else None

        return {
            "case_id": case_id,
            "target_phone": clean_target,
            "secondary_phone": clean_secondary,
            "total_records": total_records_count,
            "profile": profile,
            "data_quality_warnings": data_quality_warnings,
            "top_contacts": top_contacts,
            "hourly_timeline": hourly_counts,
            "hourly_distribution": [{"hour": h, "calls": hourly_counts[h]} for h in range(24)],
            "graph_intelligence": graph_intel,
            "graph_ego_network": graph_intel.get("ego_network", {"nodes": [], "edges": []}),
            "common_contacts": common_contacts_list,
            "shortest_path": shortest_path_list,
            "location_intelligence": {
                "towers_visited_count": len(towers_visited),
                "top_towers": top_towers,
                "coordinates_count": len(coordinates_trail),
                "sample_trail": coordinates_trail[:30]
            },
            "cell_tower_locations": [
                {
                    "cell_id": t["tower_id"],
                    "call_count": t["hits"],
                    "latitude": _tower_coords_map.get(t["tower_id"], (None, None))[0],
                    "longitude": _tower_coords_map.get(t["tower_id"], (None, None))[1],
                    "coords_available": t["tower_id"] in _tower_coords_map
                }
                for t in top_towers
            ],
            "hardware_intelligence": {
                "imei_timeline": imei_timeline
            },
            "imei_history": imei_timeline,
            "silent_periods": silent_periods_list,
            "co_travelers": co_travelers_list,
            "hypotheses_and_anomalies": hypotheses,
            "investigative_hypotheses": hypotheses,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_records": total_records_count,
                "total_pages": (total_records_count + page_size - 1) // page_size if page_size > 0 else 1
            },
            "source_records": paginated_source
        }

