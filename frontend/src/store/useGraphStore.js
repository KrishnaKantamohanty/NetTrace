import { create } from 'zustand';

export const useGraphStore = create((set) => ({
  nodes: [],
  edges: [],
  stats: {},
  selectedNode: null,
  minWeight: 1,
  layoutName: 'cose', // cose, circle, breadthfirst, grid, concentric
  highlightPath: [],

  setGraphData: (nodes, edges, stats) => set({ nodes, edges, stats }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setMinWeight: (weight) => set({ minWeight: weight }),
  setLayoutName: (layout) => set({ layoutName: layout }),
  setHighlightPath: (path) => set({ highlightPath: path }),
}));
