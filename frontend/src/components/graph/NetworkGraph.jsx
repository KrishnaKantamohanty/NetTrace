import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export default function NetworkGraph({
  nodes = [],
  edges = [],
  layoutName = 'cose',
  selectedNodeId = null,
  highlightPath = [],
  onSelectNode = null
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Convert nodes and edges to cytoscape format
    const cyElements = [];

    const pathSet = new Set(highlightPath);

    nodes.forEach((n) => {
      let nodeColor = '#38bdf8'; // Default cyan
      if (n.isHub) nodeColor = '#06b6d4'; // Bright Hub
      if (n.isBridge) nodeColor = '#f59e0b'; // Bridge amber
      if (n.isSuspect || pathSet.has(n.id)) nodeColor = '#f43f5e'; // Suspect / path crimson
      if (n.isSeed || n.hop_distance === 0) nodeColor = '#ec4899'; // Seed suspect magenta

      const size = Math.min(65, Math.max(28, 28 + (n.degree || 1) * 3));

      cyElements.push({
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label || n.id,
          degree: n.degree,
          color: nodeColor,
          size: size,
          totalCalls: n.totalCalls,
          isHub: n.isHub,
          isBridge: n.isBridge,
          lateNightCalls: n.lateNightCalls,
        },
      });
    });

    edges.forEach((e) => {
      const isPathEdge =
        pathSet.has(e.source) &&
        pathSet.has(e.target) &&
        Math.abs(highlightPath.indexOf(e.source) - highlightPath.indexOf(e.target)) === 1;

      cyElements.push({
        group: 'edges',
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          weight: e.weight || 1,
          edgeColor: isPathEdge ? '#f43f5e' : 'rgba(100, 116, 139, 0.45)',
          edgeWidth: isPathEdge ? 4 : Math.min(8, Math.max(1.5, Math.log2((e.weight || 1) + 1) * 1.5)),
        },
      });
    });

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'width': 'data(size)',
            'height': 'data(size)',
            'color': '#f8fafc',
            'font-family': 'monospace',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-opacity': 0.7,
            'text-background-color': '#030712',
            'text-background-padding': '2px',
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.8,
            'transition-property': 'background-color, border-width',
            'transition-duration': '0.3s',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#06b6d4',
            'border-width': 4,
            'shadow-blur': 20,
            'shadow-color': '#06b6d4',
            'shadow-opacity': 0.9,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(edgeWidth)',
            'line-color': 'data(edgeColor)',
            'curve-style': 'bezier',
            'opacity': 0.85,
          },
        },
      ],
      layout: {
        name: layoutName,
        animate: false,
        padding: 40,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      if (onSelectNode) {
        const found = nodes.find((n) => n.id === node.id());
        onSelectNode(found || { id: node.id() });
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [nodes, edges, layoutName, highlightPath]);

  // Handle selectedNodeId highlight
  useEffect(() => {
    if (!cyRef.current || !selectedNodeId) return;
    const target = cyRef.current.$id(selectedNodeId);
    if (target.length > 0) {
      cyRef.current.nodes().unselect();
      target.select();
      cyRef.current.animate({
        center: { eles: target },
        zoom: 1.4,
        duration: 400,
      });
    }
  }, [selectedNodeId]);

  return (
    <div className="w-full h-full relative bg-[#040711] rounded-xl overflow-hidden border border-slate-800">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Graph Visual Key */}
      <div className="absolute bottom-4 left-4 bg-[#090d16]/90 border border-slate-700/80 backdrop-blur-md rounded-lg p-2.5 font-mono text-[10px] space-y-1.5 z-10 shadow-xl pointer-events-none">
        <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Node Roles</div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white"></div>
          <span className="text-slate-300">Central Hub (High Degree)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></div>
          <span className="text-slate-300">Bridge (Betweenness)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></div>
          <span className="text-slate-300">Target / Shortest Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-white"></div>
          <span className="text-slate-300">Subnet Seed Suspect</span>
        </div>
      </div>
    </div>
  );
}
