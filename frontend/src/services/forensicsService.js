import api from './api';

export const forensicsService = {
  // 1. Domino Relay Time-gap Matching
  getRelayChains: async (caseId, gapMinutes = 15) => {
    const res = await api.get(`/forensics/relay-chains/${caseId}?gap_minutes=${gapMinutes}`);
    return res.data;
  },

  // 2. IPDR & Telemetry Analytics
  getIPDRAnalytics: async (caseId) => {
    const res = await api.get(`/forensics/ipdr/${caseId}`);
    return res.data;
  },

  // 3. Speech Forensics
  getSpeechIntercepts: async (caseId) => {
    const res = await api.get(`/forensics/speech/${caseId}`);
    return res.data;
  },

  analyzeSpeech: async (formData) => {
    const res = await api.post('/forensics/speech/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // 4. Multi-Script OCR
  getOCRDocuments: async (caseId) => {
    const res = await api.get(`/forensics/ocr/${caseId}`);
    return res.data;
  },

  scanOCRDocument: async (formData) => {
    const res = await api.post('/forensics/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // 5. OSINT & Behavioral Intelligence
  getOSINTProfile: async (phone) => {
    const res = await api.get(`/forensics/osint/profile/${phone}`);
    return res.data;
  },

  getCrossCaseCorrelations: async (caseId, phone) => {
    const res = await api.get(`/forensics/osint/cross-case/${caseId}/${phone}`);
    return res.data;
  },

  // 6. Geofencing & 4D Spatiotemporal
  getGeofenceRules: async (caseId) => {
    const res = await api.get(`/forensics/geofence/rules/${caseId}`);
    return res.data;
  },

  getGeofenceBreaches: async (caseId) => {
    const res = await api.get(`/forensics/geofence/breaches/${caseId}`);
    return res.data;
  },

  // 7. SHA-256 Custodial Ledger
  getChainOfCustody: async (caseId) => {
    const res = await api.get(`/forensics/custody-log/${caseId}`);
    return res.data;
  },
};
