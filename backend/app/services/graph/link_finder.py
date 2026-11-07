import networkx as nx
from typing import List, Dict, Any, Optional

class LinkFinderService:
    @staticmethod
    def find_common_contacts(G: nx.Graph, target_numbers: List[str]) -> List[Dict[str, Any]]:
        """
        Finds all nodes that are adjacent to at least two of the target numbers.
        If target_numbers has only 2 elements, finds neighbors common to both.
        """
        targets = [t.strip() for t in target_numbers if t.strip() in G]
        if len(targets) < 2:
            return []

        # Find neighbors for each target
        neighbor_sets = {t: set(G.neighbors(t)) for t in targets}

        # Candidate common contacts
        all_neighbors = set().union(*neighbor_sets.values())
        # Exclude the targets themselves
        all_neighbors -= set(targets)

        results = []
        for cand in all_neighbors:
            connected_targets = [t for t in targets if cand in neighbor_sets[t]]
            if len(connected_targets) >= 2:
                breakdown = {}
                total_mutual_interactions = 0
                for t in connected_targets:
                    edge_data = G.get_edge_data(cand, t, default={})
                    calls = edge_data.get("callCount", 0)
                    sms = edge_data.get("smsCount", 0)
                    duration = edge_data.get("totalDuration", 0)
                    weight = edge_data.get("weight", calls + sms)
                    total_mutual_interactions += weight
                    breakdown[t] = {
                        "callCount": calls,
                        "smsCount": sms,
                        "totalDuration": duration,
                        "weight": weight,
                    }

                results.append({
                    "common_contact": cand,
                    "connected_targets": connected_targets,
                    "overlap_count": len(connected_targets),
                    "interaction_breakdown": breakdown,
                    "total_mutual_interactions": total_mutual_interactions,
                    "node_attrs": G.nodes[cand] if cand in G else {}
                })

        results.sort(key=lambda x: (x["overlap_count"], x["total_mutual_interactions"]), reverse=True)
        return results

    @staticmethod
    def find_shortest_path(G: nx.Graph, source: str, target: str) -> Dict[str, Any]:
        s = source.strip()
        t = target.strip()

        if s not in G or t not in G:
            return {"found": False, "path": [], "length": 0, "message": "Source or target number not present in graph."}

        try:
            path = nx.shortest_path(G, source=s, target=t)
            nodes_detail = []
            for n in path:
                attrs = G.nodes[n]
                nodes_detail.append({
                    "id": n,
                    "label": n,
                    "degree": G.degree(n),
                    "operator": attrs.get("operator", "Unknown"),
                    "totalCalls": attrs.get("totalCalls", 0),
                    "lateNightCalls": attrs.get("lateNightCalls", 0),
                })

            edges_detail = []
            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                ed = G.get_edge_data(u, v, default={})
                edges_detail.append({
                    "id": f"{u}-{v}",
                    "source": u,
                    "target": v,
                    "weight": ed.get("weight", 1),
                    "callCount": ed.get("callCount", 0),
                    "smsCount": ed.get("smsCount", 0),
                    "totalDuration": ed.get("totalDuration", 0)
                })

            return {
                "found": True,
                "path": path,
                "length": len(path) - 1,
                "nodes": nodes_detail,
                "edges": edges_detail
            }
        except nx.NetworkXNoPath:
            return {"found": False, "path": [], "length": 0, "message": f"No communication link exists between {s} and {t}."}

    @staticmethod
    def multi_hop_analysis(G: nx.Graph, seed_number: str, max_hops: int = 2) -> Dict[str, Any]:
        seed = seed_number.strip()
        if seed not in G:
            return {"seed": seed, "subgraph_nodes": [], "subgraph_edges": [], "nodes_by_hop": {}}

        # BFS expansion up to max_hops
        visited = {seed: 0}
        queue = [(seed, 0)]
        nodes_by_hop: Dict[int, List[str]] = {0: [seed]}

        for h in range(1, max_hops + 1):
            nodes_by_hop[h] = []

        while queue:
            curr, depth = queue.pop(0)
            if depth >= max_hops:
                continue

            for nbr in G.neighbors(curr):
                if nbr not in visited:
                    visited[nbr] = depth + 1
                    nodes_by_hop[depth + 1].append(nbr)
                    queue.append((nbr, depth + 1))

        sub_nodes = list(visited.keys())
        subG = G.subgraph(sub_nodes)

        # Hubs & bridges in subG
        sub_deg = nx.degree_centrality(subG) if len(subG) > 1 else {}
        sorted_sub_deg = sorted(sub_deg.items(), key=lambda x: x[1], reverse=True)
        sub_hubs = set([k for k, v in sorted_sub_deg[:max(1, len(sub_nodes) // 6)]])

        sub_btw = nx.betweenness_centrality(subG) if len(subG) > 2 else {}
        sorted_sub_btw = sorted(sub_btw.items(), key=lambda x: x[1], reverse=True)
        sub_bridges = set([k for k, v in sorted_sub_btw[:max(1, len(sub_nodes) // 6)]])

        nodes_list = []
        for n in subG.nodes():
            attrs = subG.nodes[n]
            nodes_list.append({
                "id": n,
                "label": n,
                "hop_distance": visited.get(n, 0),
                "isSeed": (n == seed),
                "isHub": (n in sub_hubs) or (n == seed),
                "isBridge": (n in sub_bridges),
                "degree": subG.degree(n),
                "totalCalls": attrs.get("totalCalls", 0),
                "totalDuration": attrs.get("totalDuration", 0),
                "lateNightCalls": attrs.get("lateNightCalls", 0),
                "operator": attrs.get("operator", "Unknown"),
                "imeis": attrs.get("imeis", []),
            })

        edges_list = []
        for u, v in subG.edges():
            ed = subG.get_edge_data(u, v, default={})
            edges_list.append({
                "id": f"{u}-{v}",
                "source": u,
                "target": v,
                "weight": ed.get("weight", 1),
                "callCount": ed.get("callCount", 0),
                "smsCount": ed.get("smsCount", 0),
            })

        return {
            "seed": seed,
            "max_hops": max_hops,
            "total_nodes": len(nodes_list),
            "total_edges": len(edges_list),
            "nodes_by_hop": nodes_by_hop,
            "nodes": nodes_list,
            "edges": edges_list
        }
