import api from './api';

export const graphService = {
  getNetworkGraph: async (caseId, minWeight = 1, limitNodes = 300) => {
    const res = await api.get(`/network/graph/${caseId}`, {
      params: { min_weight: minWeight, limit_nodes: limitNodes },
    });
    return res.data;
  },

  getCentralityRanks: async (caseId) => {
    const res = await api.get(`/network/centrality/${caseId}`);
    return res.data;
  },

  findCommonContacts: async (caseId, numbers) => {
    const res = await api.post('/network/common-contacts', {
      case_id: caseId,
      numbers,
    });
    return res.data;
  },

  getShortestPath: async (caseId, sourceNumber, targetNumber) => {
    const res = await api.post('/network/shortest-path', {
      case_id: caseId,
      source_number: sourceNumber,
      target_number: targetNumber,
    });
    return res.data;
  },

  getMultiHop: async (caseId, seedNumber, maxHops = 2) => {
    const res = await api.post('/network/multi-hop', {
      case_id: caseId,
      seed_number: seedNumber,
      max_hops: maxHops,
    });
    return res.data;
  },
};
