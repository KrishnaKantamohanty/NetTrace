import pytest
import networkx as nx
from datetime import datetime
from app.services.graph.centrality import CentralityAnalysisService
from app.services.graph.link_finder import LinkFinderService

def test_centrality_and_hubs():
    G = nx.Graph()
    # Star topology centered around hub "9811012345"
    hub = "9811012345"
    G.add_node(hub, totalCalls=100, lateNightCalls=20, operator="Airtel")
    for i in range(1, 10):
        target = f"987654321{i}"
        G.add_node(target, totalCalls=10, lateNightCalls=2, operator="Jio")
        G.add_edge(hub, target, weight=5, callCount=5, smsCount=0, totalDuration=500)

    metrics = CentralityAnalysisService.calculate_metrics(G)
    assert hub in metrics["hubs"]
    assert metrics["degree"][hub] == 1.0

def test_common_contact_detection():
    G = nx.Graph()
    # Target 1 and Target 2 both communicate with Intermediary
    target1 = "9811012345"
    target2 = "9876543210"
    intermediary = "9998887771"

    G.add_edge(target1, intermediary, weight=10, callCount=10, smsCount=0, totalDuration=600)
    G.add_edge(target2, intermediary, weight=8, callCount=6, smsCount=2, totalDuration=400)

    common = LinkFinderService.find_common_contacts(G, [target1, target2])
    assert len(common) == 1
    assert common[0]["common_contact"] == intermediary
    assert common[0]["total_mutual_interactions"] == 18

def test_shortest_path():
    G = nx.Graph()
    # Chain: A -> B -> C -> D
    G.add_edge("A", "B", weight=2, callCount=2, smsCount=0)
    G.add_edge("B", "C", weight=3, callCount=3, smsCount=0)
    G.add_edge("C", "D", weight=1, callCount=1, smsCount=0)

    res = LinkFinderService.find_shortest_path(G, "A", "D")
    assert res["found"] is True
    assert res["path"] == ["A", "B", "C", "D"]
    assert res["length"] == 3
