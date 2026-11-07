import { create } from 'zustand';

export const useCDRStore = create((set) => ({
  cases: [],
  selectedCaseId: localStorage.getItem('nettrace_selected_case') || 'CASE-DL-2026-904',
  activeView: 'dashboard', // dashboard, network, gis, forensics
  hasUploadedData: localStorage.getItem('nettrace_has_uploaded') === 'true',
  isUploadOpen: false,
  selectedSuspect: null,
  toastMessage: null,

  setHasUploadedData: (val) => {
    localStorage.setItem('nettrace_has_uploaded', val ? 'true' : 'false');
    set({ hasUploadedData: val });
  },
  setCases: (cases) => set({ cases }),
  setSelectedCaseId: (id) => {
    localStorage.setItem('nettrace_selected_case', id);
    set({ selectedCaseId: id, selectedSuspect: null });
  },
  setActiveView: (view) => set({ activeView: view }),
  setIsUploadOpen: (open) => set({ isUploadOpen: open }),
  setSelectedSuspect: (phone) => set({ selectedSuspect: phone }),
  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => set({ toastMessage: null }), 4000);
  },
  resetWorkspace: () => {
    localStorage.removeItem('nettrace_has_uploaded');
    set({ hasUploadedData: false, activeView: 'dashboard', selectedSuspect: null });
  },
}));

