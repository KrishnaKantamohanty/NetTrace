import networkx as nx
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord
from app.db.neo4j import neo4j_client
import logging

logger = logging.getLogger("nettrace.graph")

class GraphBuilder:
    @staticmethod
    def build_networkx_graph(db: Session, case_id: str) -> nx.Graph:
        """
        Builds an undirected weighted graph for link analysis,
        where node = phone number, edge = aggregated communications.
        """
        records = db.query(CDRRecord).filter(CDRRecord.case_id == case_id).all()
        G = nx.Graph()

        node_data: Dict[str, Dict[str, Any]] = {}
        edge_data: Dict[Tuple[str, str], Dict[str, Any]] = {}

        for r in records:
            c = str(r.caller_number).strip()
            tgt = str(r.receiver_number).strip()

            if not c or not tgt or c == tgt:
                continue

            # Node metadata
            for p in [c, tgt]:
                if p not in node_data:
                    node_data[p] = {
                        "total_calls": 0,
                        "total_duration": 0,
                        "late_night_calls": 0,
                        "operators": set(),
                        "imeis": set(),
                    }

            node_data[c]["total_calls"] += 1
            node_data[c]["total_duration"] += (r.duration_seconds or 0)
            if r.operator:
                node_data[c]["operators"].add(r.operator)
            if r.imei:
                node_data[c]["imeis"].add(r.imei)

            h = r.timestamp.hour
            if 0 <= h < 4:
                node_data[c]["late_night_calls"] += 1
                node_data[tgt]["late_night_calls"] += 1

            # Edge metadata (order-independent key for undirected interaction)
            edge_key = (min(c, tgt), max(c, tgt))
            if edge_key not in edge_data:
                edge_data[edge_key] = {
                    "source": c,
                    "target": tgt,
                    "call_count": 0,
                    "sms_count": 0,
                    "total_duration": 0,
                    "first_call": r.timestamp.isoformat(),
                    "last_call": r.timestamp.isoformat(),
                }

            if r.call_type == "SMS":
                edge_data[edge_key]["sms_count"] += 1
            else:
                edge_data[edge_key]["call_count"] += 1

            edge_data[edge_key]["total_duration"] += (r.duration_seconds or 0)
            ts = r.timestamp.isoformat()
            if ts < edge_data[edge_key]["first_call"]:
                edge_data[edge_key]["first_call"] = ts
            if ts > edge_data[edge_key]["last_call"]:
                edge_data[edge_key]["last_call"] = ts

        # Add nodes to NetworkX
        for p, d in node_data.items():
            G.add_node(
                p,
                label=p,
                totalCalls=d["total_calls"],
                totalDuration=d["total_duration"],
                lateNightCalls=d["late_night_calls"],
                operator=list(d["operators"])[0] if d["operators"] else "Unknown",
                imeis=list(d["imeis"]),
            )

        # Add edges to NetworkX
        for (u, v), d in edge_data.items():
            weight = d["call_count"] + d["sms_count"]
            G.add_edge(
                u,
                v,
                weight=weight,
                callCount=d["call_count"],
                smsCount=d["sms_count"],
                totalDuration=d["total_duration"],
                firstCall=d["first_call"],
                lastCall=d["last_call"],
            )

        return G

    @staticmethod
    def sync_to_neo4j(G: nx.Graph, case_id: str):
        """Optionally persists nodes & edges to Neo4j if connected."""
        if not neo4j_client.is_connected:
            return

        session = neo4j_client.get_session()
        if not session:
            return

        try:
            with session:
                # Upsert nodes
                for n, attrs in G.nodes(data=True):
                    session.run(
                        """
                        MERGE (p:PhoneNumber {number: $number, case_id: $case_id})
                        SET p.totalCalls = $totalCalls,
                            p.totalDuration = $totalDuration,
                            p.lateNightCalls = $lateNightCalls,
                            p.operator = $operator
                        """,
                        number=n,
                        case_id=case_id,
                        totalCalls=attrs.get("totalCalls", 0),
                        totalDuration=attrs.get("totalDuration", 0),
                        lateNightCalls=attrs.get("lateNightCalls", 0),
                        operator=attrs.get("operator", "Unknown")
                    )

                # Upsert edges
                for u, v, attrs in G.edges(data=True):
                    session.run(
                        """
                        MATCH (a:PhoneNumber {number: $u, case_id: $case_id})
                        MATCH (b:PhoneNumber {number: $v, case_id: $case_id})
                        MERGE (a)-[r:COMMUNICATED {case_id: $case_id}]-(b)
                        SET r.weight = $weight,
                            r.callCount = $callCount,
                            r.smsCount = $smsCount,
                            r.totalDuration = $totalDuration
                        """,
                        u=u,
                        v=v,
                        case_id=case_id,
                        weight=attrs.get("weight", 1),
                        callCount=attrs.get("callCount", 0),
                        smsCount=attrs.get("smsCount", 0),
                        totalDuration=attrs.get("totalDuration", 0)
                    )
            logger.info(f"Synchronized {G.number_of_nodes()} nodes and {G.number_of_edges()} edges to Neo4j.")
        except Exception as e:
            logger.error(f"Failed to sync graph to Neo4j: {e}")
