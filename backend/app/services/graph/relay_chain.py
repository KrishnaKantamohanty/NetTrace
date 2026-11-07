from typing import List, Dict, Any
from datetime import timedelta
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord

class RelayChainService:
    """
    Domino / Relay Time-gap Matching:
    Detects sequential chain-reaction communications (A -> B -> C -> ...)
    where B calls C within a short window Delta t after receiving a call from A.
    Crucial for identifying crime syndicate chain-of-command orders & Hawala instruction relays.
    """

    @staticmethod
    def detect_relay_chains(
        db: Session,
        case_id: str,
        max_gap_minutes: int = 15,
        min_chain_length: int = 3
    ) -> List[Dict[str, Any]]:
        records = db.query(CDRRecord).filter(
            CDRRecord.case_id == case_id
        ).order_by(CDRRecord.timestamp.asc()).all()

        if len(records) < 2:
            return []

        # Index transactions by participant
        # For each call A -> B at t1, search for subsequent call B -> C at t2 where t2 > t1 and t2 - t1 <= max_gap
        max_delta = timedelta(minutes=max_gap_minutes)
        chains = []

        # Build list of call tuples: (id, caller, receiver, timestamp, duration, tower, operator)
        calls = [
            {
                "id": r.id,
                "caller": str(r.caller_number).strip(),
                "receiver": str(r.receiver_number).strip(),
                "time": r.timestamp,
                "duration": r.duration_seconds,
                "tower": r.cell_tower_id,
                "operator": r.operator or "Unknown"
            }
            for r in records if r.caller_number and r.receiver_number
        ]

        # Greedy sequence finder for relays
        visited_pairs = set()

        for i, c1 in enumerate(calls):
            # c1: A -> B
            b_target = c1["receiver"]
            a_source = c1["caller"]

            for j in range(i + 1, min(len(calls), i + 80)):
                c2 = calls[j]
                # c2 must be initiated by B to someone else C (not back to A)
                if c2["caller"] == b_target and c2["receiver"] != a_source:
                    delta = c2["time"] - c1["time"]
                    if timedelta(seconds=0) <= delta <= max_delta:
                        c_target = c2["receiver"]
                        chain_key = (c1["id"], c2["id"])
                        if chain_key in visited_pairs:
                            continue
                        visited_pairs.add(chain_key)

                        delay_secs = int(delta.total_seconds())

                        # Check if C calls D (3-hop relay)
                        hop3_call = None
                        for k in range(j + 1, min(len(calls), j + 60)):
                            c3 = calls[k]
                            if c3["caller"] == c_target and c3["receiver"] not in [a_source, b_target]:
                                delta2 = c3["time"] - c2["time"]
                                if timedelta(seconds=0) <= delta2 <= max_delta:
                                    hop3_call = c3
                                    break

                        chain_hops = [
                            {
                                "hop": 1,
                                "caller": a_source,
                                "receiver": b_target,
                                "time": c1["time"].isoformat(),
                                "duration": c1["duration"],
                                "tower": c1["tower"],
                                "operator": c1["operator"],
                            },
                            {
                                "hop": 2,
                                "caller": b_target,
                                "receiver": c_target,
                                "time": c2["time"].isoformat(),
                                "duration": c2["duration"],
                                "tower": c2["tower"],
                                "operator": c2["operator"],
                                "delay_after_prev_secs": delay_secs,
                            }
                        ]

                        subscribers = [a_source, b_target, c_target]
                        total_delay = delay_secs

                        if hop3_call:
                            delay3 = int((hop3_call["time"] - c2["time"]).total_seconds())
                            chain_hops.append({
                                "hop": 3,
                                "caller": c_target,
                                "receiver": hop3_call["receiver"],
                                "time": hop3_call["time"].isoformat(),
                                "duration": hop3_call["duration"],
                                "tower": hop3_call["tower"],
                                "operator": hop3_call["operator"],
                                "delay_after_prev_secs": delay3,
                            })
                            subscribers.append(hop3_call["receiver"])
                            total_delay += delay3

                        # Suspicion rating based on rapid time-gap (< 3 mins is high severity)
                        severity = "CRITICAL" if total_delay < 180 else "HIGH" if total_delay < 600 else "ELEVATED"

                        chains.append({
                            "chain_id": f"RELAY-{len(chains)+1:03d}",
                            "subscribers": subscribers,
                            "length": len(chain_hops) + 1,
                            "total_relay_time_seconds": total_delay,
                            "severity": severity,
                            "initial_call_time": c1["time"].isoformat(),
                            "final_call_time": chain_hops[-1]["time"],
                            "hops": chain_hops
                        })

        # Sort by fastest relay time (rapid sequential instructions)
        chains.sort(key=lambda x: (x["severity"] == "CRITICAL", -x["length"], x["total_relay_time_seconds"]))
        return chains[:30]
