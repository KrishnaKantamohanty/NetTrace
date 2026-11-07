import api from './api';

export const cdrService = {
  // Cases
  getCases: async () => {
    const res = await api.get('/cases');
    return res.data;
  },

  createCase: async (caseData) => {
    const res = await api.post('/cases', caseData);
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
