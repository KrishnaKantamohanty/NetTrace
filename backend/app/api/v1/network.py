from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.postgres import get_db
from app.models.pydantic_models import (
    NetworkGraphResponse,
    GraphNode,
    GraphEdge,
    CommonContactRequest,
    ShortestPathRequest,
    ShortestPathResponse,
    MultiHopRequest
)
from app.services.graph.graph_builder import GraphBuilder
from app.services.graph.centrality import CentralityAnalysisService
from app.services.graph.link_finder import LinkFinderService

router = APIRouter(prefix="/network", tags=["Network Link Analysis (Graph Intelligence)"])

@router.get("/graph/{case_id}", response_model=NetworkGraphResponse)
def get_network_graph(
    case_id: str,
    min_weight: int = Query(1, ge=1),
    limit_nodes: int = Query(300, ge=10, le=2000),
    db: Session = Depends(get_db)
):
    G = GraphBuilder.build_networkx_graph(db, case_id)
    if G.number_of_nodes() == 0:
        return {"nodes": [], "edges": [], "stats": {"nodes": 0, "edges": 0, "density": 0}}

    metrics = CentralityAnalysisService.calculate_metrics(G)
    hubs = set(metrics["hubs"])
    bridges = set(metrics["bridges"])
    degrees = metrics["degree"]
    betweenness = metrics["betweenness"]
    pageranks = metrics["pagerank"]

    # Filter edges by min_weight
    edges_to_return = []
    nodes_in_filtered_edges = set()

    for u, v, data in G.edges(data=True):
        weight = data.get("weight", 1)
        if weight >= min_weight:
            edges_to_return.append({
                "id": f"{u}-{v}",
                "source": u,
                "target": v,
                "weight": weight,
                "callCount": data.get("callCount", 0),
                "smsCount": data.get("smsCount", 0),
                "totalDuration": data.get("totalDuration", 0),
                "firstCall": data.get("firstCall"),
                "lastCall": data.get("lastCall"),
            })
            nodes_in_filtered_edges.add(u)
            nodes_in_filtered_edges.add(v)

    # Build node list
    nodes_to_return = []
    # If all nodes were filtered, fall back to top nodes
    target_nodes = nodes_in_filtered_edges if nodes_in_filtered_edges else list(G.nodes())
    # Limit nodes to avoid frontend lag on enormous dumps
    for n in list(target_nodes)[:limit_nodes]:
        attrs = G.nodes[n]
        nodes_to_return.append({
            "id": n,
            "label": n,
            "degree": G.degree(n),
            "betweenness": round(betweenness.get(n, 0.0), 4),
            "pagerank": round(pageranks.get(n, 0.0), 4),
            "totalCalls": attrs.get("totalCalls", 0),
            "totalDuration": attrs.get("totalDuration", 0),
            "lateNightCalls": attrs.get("lateNightCalls", 0),
            "isSuspect": False,
            "isHub": n in hubs,
            "isBridge": n in bridges,
            "operator": attrs.get("operator", "Unknown"),
            "imeis": attrs.get("imeis", []),
        })

    import networkx as nx
    density = round(nx.density(G), 4)

    return {
        "nodes": nodes_to_return,
        "edges": edges_to_return[:1000],
        "stats": {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "filtered_nodes": len(nodes_to_return),
            "filtered_edges": len(edges_to_return),
            "density": density,
            "hubs_count": len(hubs),
            "bridges_count": len(bridges),
        }
    }

@router.get("/centrality/{case_id}")
def get_centrality_ranks(case_id: str, db: Session = Depends(get_db)):
    G = GraphBuilder.build_networkx_graph(db, case_id)
    return CentralityAnalysisService.rank_nodes(G)

@router.post("/common-contacts")
def find_common_contacts(req: CommonContactRequest, db: Session = Depends(get_db)):
    G = GraphBuilder.build_networkx_graph(db, req.case_id)
    return LinkFinderService.find_common_contacts(G, req.numbers)

@router.post("/shortest-path", response_model=ShortestPathResponse)
def get_shortest_path(req: ShortestPathRequest, db: Session = Depends(get_db)):
    G = GraphBuilder.build_networkx_graph(db, req.case_id)
    res = LinkFinderService.find_shortest_path(G, req.source_number, req.target_number)
    if not res.get("found"):
        raise HTTPException(status_code=404, detail=res.get("message", "No path found"))
    return res

@router.post("/multi-hop")
def get_multi_hop_subgraph(req: MultiHopRequest, db: Session = Depends(get_db)):
    G = GraphBuilder.build_networkx_graph(db, req.case_id)
    return LinkFinderService.multi_hop_analysis(G, req.seed_number, max_hops=req.max_hops)
