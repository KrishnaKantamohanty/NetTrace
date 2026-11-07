import networkx as nx
from typing import Dict, Any, List

class CentralityAnalysisService:
    @staticmethod
    def calculate_metrics(G: nx.Graph) -> Dict[str, Any]:
        if G.number_of_nodes() == 0:
            return {"degree": {}, "betweenness": {}, "closeness": {}, "pagerank": {}, "hubs": [], "bridges": []}

        # 1. Degree Centrality
        degree_dict = nx.degree_centrality(G)
        
        # 2. Betweenness Centrality
        betweenness_dict = nx.betweenness_centrality(G, weight="weight") if G.number_of_nodes() > 2 else {n: 0.0 for n in G.nodes()}

        # 3. Closeness Centrality
        closeness_dict = nx.closeness_centrality(G)

        # 4. PageRank
        try:
            pagerank_dict = nx.pagerank(G, weight="weight")
        except Exception:
            pagerank_dict = {n: 1.0 / len(G.nodes()) for n in G.nodes()}

        # Identify Hubs (top 15% degree) and Bridges (top 15% betweenness)
        sorted_degrees = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)
        sorted_betweenness = sorted(betweenness_dict.items(), key=lambda x: x[1], reverse=True)

        k = max(1, int(len(G.nodes()) * 0.15))
        hubs = [item[0] for item in sorted_degrees[:k]]
        bridges = [item[0] for item in sorted_betweenness[:k] if betweenness_dict[item[0]] > 0]

        return {
            "degree": degree_dict,
            "betweenness": betweenness_dict,
            "closeness": closeness_dict,
            "pagerank": pagerank_dict,
            "hubs": hubs,
            "bridges": bridges,
        }

    @staticmethod
    def rank_nodes(G: nx.Graph) -> List[Dict[str, Any]]:
        metrics = CentralityAnalysisService.calculate_metrics(G)
        degree_dict = metrics["degree"]
        betweenness_dict = metrics["betweenness"]
        closeness_dict = metrics["closeness"]
        pagerank_dict = metrics["pagerank"]
        hubs_set = set(metrics["hubs"])
        bridges_set = set(metrics["bridges"])

        ranked = []
        for n in G.nodes():
            attrs = G.nodes[n]
            ranked.append({
                "id": n,
                "label": n,
                "degree_centrality": round(degree_dict.get(n, 0.0), 4),
                "betweenness_centrality": round(betweenness_dict.get(n, 0.0), 4),
                "closeness_centrality": round(closeness_dict.get(n, 0.0), 4),
                "pagerank": round(pagerank_dict.get(n, 0.0), 4),
                "raw_degree": G.degree(n),
                "total_calls": attrs.get("totalCalls", 0),
                "total_duration": attrs.get("totalDuration", 0),
                "late_night_calls": attrs.get("lateNightCalls", 0),
                "operator": attrs.get("operator", "Unknown"),
                "is_hub": n in hubs_set,
                "is_bridge": n in bridges_set,
            })

        # Rank by combined centrality score
        ranked.sort(key=lambda x: (x["degree_centrality"] + x["betweenness_centrality"] * 2 + x["pagerank"]), reverse=True)
        return ranked
