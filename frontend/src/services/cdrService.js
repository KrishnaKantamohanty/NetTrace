import api from './api';

export const cdrService = {
  // Cases & Case Management (Feature 1)
  getCases: async () => {
    const res = await api.get('/cases');
    return res.data;
  },

  createCase: async (caseData) => {
    const res = await api.post('/cases', caseData);
    return res.data;
  },

  startNewInvestigation: async (caseData) => {
    const res = await api.post('/cases/new-investigation', caseData);
    return res.data;
  },

  clearInvestigationData: async (caseId, preserveMetadata = true, badge = 'CC-9042') => {
    const res = await api.delete(`/cases/${caseId}/data`, {
      params: { preserve_metadata: preserveMetadata, badge },
    });
    return res.data;
  },

  adminResetAllCases: async (confirmPhrase = 'RESET_ALL_CASES', badge = 'ADM-001') => {
    const res = await api.post('/cases/admin/reset', {
      confirm: confirmPhrase,
      badge,
    });
    return res.data;
  },

  uploadCDRFile: async (formData) => {
    const res = await api.post('/cases/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  seedDemoData: async () => {
    const res = await api.post('/seed-demo-data');
    return res.data;
  },

  // Party A / Party B Call Analysis (Feature 2)
  getPartyAnalysis: async (caseId, params = {}) => {
    const res = await api.get(`/analytics/party-analysis/${caseId}`, { params });
    return res.data;
  },

  // Conversation Duration Analysis (Feature 3)
  getDurationAnalysis: async (caseId, params = {}) => {
    const res = await api.get(`/analytics/duration-analysis/${caseId}`, { params });
    return res.data;
  },

  // Deep Investigation Module (Feature 4)
  getDeepInvestigation: async (caseId, params = {}) => {
    const res = await api.get(`/analytics/deep-investigation/${caseId}`, { params });
    return res.data;
  },

  // Analytics
  getTimeline: async (caseId, caller = null) => {
    const params = caller ? { caller } : {};
    const res = await api.get(`/analytics/timeline/${caseId}`, { params });
    return res.data;
  },

  getIMEISwaps: async (caseId, minSwaps = 1) => {
    const res = await api.get(`/analytics/imei-swaps/${caseId}`, {
      params: { min_swaps: minSwaps },
    });
    return res.data;
  },

  getCaseSummary: async (caseId) => {
    const res = await api.get(`/analytics/summary/${caseId}`);
    return res.data;
  },

  exportPdfUrl: (caseId) => `/api/v1/analytics/export/pdf/${caseId}`,
  exportExcelUrl: (caseId) => `/api/v1/analytics/export/excel/${caseId}`,
  exportSection65BUrl: (caseId) => `/api/v1/analytics/export/section-65b/${caseId}`,

  // LEA Advanced Features
  getCoTravelers: async (caseId, targetMsisdn = null, windowMinutes = 30) => {
    const params = {};
    if (targetMsisdn) params.target_msisdn = targetMsisdn;
    if (windowMinutes) params.window_minutes = windowMinutes;
    const res = await api.get(`/gis/co-travelers/${caseId}`, { params });
    return res.data;
  },

  getSilentPeriods: async (caseId, targetMsisdn = null, minGapHours = 3.0) => {
    const params = { min_gap_hours: minGapHours };
    if (targetMsisdn) params.target_msisdn = targetMsisdn;
    const res = await api.get(`/analytics/silent-periods/${caseId}`, { params });
    return res.data;
  },

  getIMEISIMTimeline: async (caseId, target = null) => {
    const params = target ? { target } : {};
    const res = await api.get(`/analytics/imei-sim-timeline/${caseId}`, { params });
    return res.data;
  },

  // GIS
  getCaseTowers: async (caseId) => {
    const res = await api.get(`/gis/towers/${caseId}`);
    return res.data;
  },

  getSuspectRoute: async (caseId, phoneNumber) => {
    const res = await api.get(`/gis/route/${caseId}/${phoneNumber}`);
    return res.data;
  },

  runTowerDump: async (caseId, payload) => {
    const res = await api.post(`/gis/tower-dump/${caseId}`, payload);
    return res.data;
  },
};
