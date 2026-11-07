import React, { useEffect, useState } from 'react';
import {
  Share2,
  GitMerge,
  Route,
  X,
  Target,
  PhoneCall,
  Smartphone,
  Moon,
  Zap,
  Info,
  MapPin,
  User,
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { useGraphStore } from '../store/useGraphStore';
import { graphService } from '../services/graphService';
import NetworkGraph from '../components/graph/NetworkGraph';
import GraphToolbar from '../components/graph/GraphToolbar';
import CentralityRanks from '../components/graph/CentralityRanks';
import OSINTModal from '../components/common/OSINTModal';
import Loader from '../components/common/Loader';

export default function LinkAnalysis() {
  const { selectedCaseId, selectedSuspect, setSelectedSuspect, setActiveView, showToast } = useCDRStore();
  const {
    nodes,
    edges,
    stats,
    setGraphData,
    minWeight,
    layoutName,
    highlightPath,
    setHighlightPath,
  } = useGraphStore();

  const [loading, setLoading] = useState(true);
  const [rankedNodes, setRankedNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHubsOnly, setFilterHubsOnly] = useState(false);
  const [osintPhone, setOsintPhone] = useState(null);

  // Filtered nodes & edges when Core Hubs Only is toggled
  const displayNodes = React.useMemo(() => {
    if (!filterHubsOnly) return nodes;
    return nodes.filter((n) => n.isHub || (n.degree && n.degree >= 3));
  }, [nodes, filterHubsOnly]);

  const displayEdges = React.useMemo(() => {
    if (!filterHubsOnly) return edges;
    const nodeSet = new Set(displayNodes.map((n) => n.id));
    return edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
  }, [edges, displayNodes, filterHubsOnly]);

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    const target = nodes.find((n) => n.id.toLowerCase().includes(query) || (n.label && n.label.toLowerCase().includes(query)));
    if (target) {
      setSelectedNode(target);
      showToast(`Located suspect ${target.id} on graph.`);
    } else {
      showToast(`No contact matching '${searchQuery}' found in current network.`);
    }
  };

  // Modals state
  const [commonModalOpen, setCommonModalOpen] = useState(false);
  const [commonNumbersInput, setCommonNumbersInput] = useState('9811012345, 9876543210');
  const [commonResults, setCommonResults] = useState(null);
  const [commonLoading, setCommonLoading] = useState(false);

  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [sourceInput, setSourceInput] = useState('9811012345');
  const [targetInput, setTargetInput] = useState('9123456780');
  const [pathResult, setPathResult] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);

  const loadGraph = async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      const [gData, rData] = await Promise.all([
        graphService.getNetworkGraph(selectedCaseId, minWeight, 400),
        graphService.getCentralityRanks(selectedCaseId),
      ]);
      setGraphData(gData.nodes, gData.edges, gData.stats);
      setRankedNodes(rData);

      if (selectedSuspect) {
        const found = gData.nodes.find((n) => n.id === selectedSuspect);
        if (found) setSelectedNode(found);
      }
    } catch (err) {
      showToast('Error loading graph: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [selectedCaseId, minWeight]);

  const handleRunCommonContacts = async () => {
    const list = commonNumbersInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length < 2) {
      showToast('Please enter at least 2 phone numbers separated by commas.');
      return;
    }
    try {
      setCommonLoading(true);
      const res = await graphService.findCommonContacts(selectedCaseId, list);
      setCommonResults(res);
      showToast(`Found ${res.length} mutual contacts.`);
    } catch (err) {
      showToast('Common contacts failed: ' + err.message);
    } finally {
      setCommonLoading(false);
    }
  };

  const handleRunShortestPath = async () => {
    if (!sourceInput || !targetInput) {
      showToast('Please specify both source and target numbers.');
      return;
    }
    try {
      setPathLoading(true);
      const res = await graphService.getShortestPath(selectedCaseId, sourceInput, targetInput);
      setPathResult(res);
      setHighlightPath(res.path || []);
      showToast(`Shortest path found: ${res.length} hops.`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'No path found between targets');
      setPathResult(null);
      setHighlightPath([]);
    } finally {
      setPathLoading(false);
    }
  };

  const [subnetSeed, setSubnetSeed] = useState(null);

  const handleMultiHopExpand = async (nodeId) => {
    try {
      setLoading(true);
      const res = await graphService.getMultiHop(selectedCaseId, nodeId, 2);
      // Update graph with isolated 2-hop neighborhood
      setGraphData(res.nodes, res.edges, {
        total_nodes: res.total_nodes,
        total_edges: res.total_edges,
        isSubnet: true,
        seed: nodeId,
      });
      setSubnetSeed(nodeId);
      const seedNode = res.nodes.find((n) => n.id === nodeId);
      if (seedNode) setSelectedNode(seedNode);
      showToast(`Subnet isolated: ${res.total_nodes} nodes within 2 hops of ${nodeId}`);
    } catch (err) {
      showToast('Failed to expand multi-hop: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFullGraph = () => {
    setSubnetSeed(null);
    loadGraph();
    showToast('Restored full investigation network graph');
  };

  if (loading && nodes.length === 0) {
    return <Loader text="Calculating Centrality Metrics & Link Graphs..." />;
  }

  return (
    <div className="space-y-4 pb-12 font-mono">
      {/* Top Toolbar */}
      <GraphToolbar
        onOpenCommonContacts={() => setCommonModalOpen(true)}
        onOpenShortestPath={() => setPathModalOpen(true)}
        totalNodes={filterHubsOnly ? displayNodes.length : (stats?.total_nodes || nodes.length)}
        totalEdges={filterHubsOnly ? displayEdges.length : (stats?.total_edges || edges.length)}
        onRefresh={() => {
          setSubnetSeed(null);
          loadGraph();
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        filterHubsOnly={filterHubsOnly}
        onToggleHubsOnly={() => setFilterHubsOnly(!filterHubsOnly)}
      />

      {/* Subnet Focus Mode Indicator Banner */}
      {subnetSeed && (
        <div className="bg-amber-950/40 border border-amber-500/50 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-amber-200 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Target className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              <b className="text-amber-400">2-HOP SUBNET FOCUS:</b> Showing suspect{' '}
              <b className="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-amber-500/40">
                {subnetSeed}
              </b>{' '}
              and all {nodes.length} directly/indirectly connected contacts ({edges.length} calls mapped).
            </span>
          </div>
          <button
            onClick={handleResetFullGraph}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            Reset to Full Graph
          </button>
        </div>
      )}

      {/* Main Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[720px]">
        {/* Cytoscape Canvas */}
        <div className="lg:col-span-3 relative h-full rounded-xl overflow-hidden">
          <NetworkGraph
            nodes={displayNodes}
            edges={displayEdges}
            layoutName={layoutName}
            selectedNodeId={selectedNode?.id}
            highlightPath={highlightPath}
            onSelectNode={(node) => setSelectedNode(node)}
          />

          {/* Selected Node Details Drawer */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-[#090d16]/95 border border-cyan-500/40 backdrop-blur-md rounded-xl p-4 shadow-2xl z-20 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-100">{selectedNode.id}</span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">OPERATOR</div>
                  <div className="font-bold text-cyan-400">{selectedNode.operator || 'Unknown'}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">TOTAL DEGREE</div>
                  <div className="font-bold">{selectedNode.degree || 0} links</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">CALL VOLUME</div>
                  <div className="font-bold">{selectedNode.totalCalls || 0} calls</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">LATE NIGHT</div>
                  <div className="font-bold text-rose-400">{selectedNode.lateNightCalls || 0} calls</div>
                </div>
              </div>

              {selectedNode.imeis && selectedNode.imeis.length > 0 && (
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] space-y-1">
                  <div className="text-slate-500 flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-amber-400" />
                    ASSOCIATED HARDWARE IMEIS
                  </div>
                  <div className="space-y-0.5 max-h-16 overflow-y-auto text-amber-300">
                    {selectedNode.imeis.map((im, idx) => (
                      <div key={idx}>{im}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1 flex-wrap">
                <button
                  onClick={() => handleMultiHopExpand(selectedNode.id)}
                  className="flex-1 py-1.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 hover:bg-cyan-900 text-[10px] font-bold"
                >
                  Expand 2-Hops
                </button>
                <button
                  onClick={() => {
                    setSelectedSuspect(selectedNode.id);
                    setActiveView('gis');
                  }}
                  className="flex-1 py-1.5 rounded bg-rose-950 text-rose-300 border border-rose-700/60 hover:bg-rose-900 text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  Trace Route
                </button>
                <button
                  onClick={() => setOsintPhone(selectedNode.id)}
                  className="w-full py-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <User className="w-3 h-3 text-cyan-400" />
                  OSINT Dossier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Centrality Rankings Sidebar */}
        <div className="p-4 rounded-xl cyber-card overflow-hidden flex flex-col justify-between">
          <CentralityRanks
            rankedNodes={rankedNodes}
            selectedNodeId={selectedNode?.id}
            onSelectNode={(n) => {
              setSelectedNode(n);
              const target = nodes.find((node) => node.id === n.id);
              if (target) setSelectedNode(target);
            }}
          />
        </div>
      </div>

      {/* Common Contact Detection Modal */}
      {commonModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-cyan-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-slate-100">Common Contact & Mutual Link Detection</h3>
              </div>
              <button
                onClick={() => setCommonModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">
                  Target Phone Numbers (Comma-separated)
                </label>
                <input
                  type="text"
                  value={commonNumbersInput}
                  onChange={(e) => setCommonNumbersInput(e.target.value)}
                  placeholder="e.g. 9811012345, 9876543210"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleRunCommonContacts}
                  disabled={commonLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  {commonLoading ? 'Detecting Intermediaries...' : 'Compute Mutual Intermediaries'}
                </button>
              </div>

              {commonResults && (
                <div className="space-y-2 pt-2 border-t border-slate-800 max-h-64 overflow-y-auto">
                  <div className="text-[11px] text-slate-400">
                    Found <b>{commonResults.length}</b> common contacts:
                  </div>
                  {commonResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 text-sm">
                          {item.common_contact}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px]">
                          {item.total_mutual_interactions} Mutual Interactions
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Connected to: <b>{item.connected_targets.join(', ')}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shortest Path Modal */}
      {pathModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-rose-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-slate-100">
                  Shortest Communication Path Analysis (Dijkstra)
                </h3>
              </div>
              <button onClick={() => setPathModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Source Suspect Number</label>
                  <input
                    type="text"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Suspect Number</label>
                  <input
                    type="text"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleRunShortestPath}
                  disabled={pathLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  {pathLoading ? 'Tracing Shortest Path...' : 'Trace Path & Highlight on Graph'}
                </button>
              </div>

              {pathResult && (
                <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-500/40 space-y-2">
                  <div className="font-bold text-rose-300">
                    Communication Chain Found ({pathResult.length} hops):
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-sm font-bold">
                    {pathResult.path.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="px-2.5 py-1 rounded bg-slate-900 border border-rose-500/50 text-cyan-300">
                          {step}
                        </span>
                        {idx < pathResult.path.length - 1 && (
                          <span className="text-rose-400">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OSINT Dossier Modal */}
      {osintPhone && (
        <OSINTModal phone={osintPhone} onClose={() => setOsintPhone(null)} />
      )}
    </div>
  );
}
