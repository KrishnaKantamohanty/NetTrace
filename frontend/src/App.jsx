import React, { useEffect } from 'react';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import LoginModal from './components/common/LoginModal';
import Dashboard from './views/Dashboard';
import LinkAnalysis from './views/LinkAnalysis';
import GeoSpatialView from './views/GeoSpatialView';
import ForensicsReportView from './views/ForensicsReportView';
import IPDRView from './views/IPDRView';
import SpeechOCRView from './views/SpeechOCRView';
import PartyAnalysisView from './views/PartyAnalysisView';
import DurationAnalysisView from './views/DurationAnalysisView';
import DeepInvestigationView from './views/DeepInvestigationView';
import OfficerManagementView from './views/OfficerManagementView';
import UploadModal from './views/UploadModal';
import { useCDRStore } from './store/useCDRStore';
import { cdrService } from './services/cdrService';

export default function App() {
  const {
    activeView,
    toastMessage,
    setCases,
    selectedCaseId,
    setSelectedCaseId,
    hasUploadedData,
    showLoginModal,
    setShowLoginModal,
    isAuthenticated,
  } = useCDRStore();

  useEffect(() => {
    async function initCases() {
      try {
        const casesList = await cdrService.getCases();
        setCases(casesList);
        if (casesList.length > 0 && !selectedCaseId) {
          setSelectedCaseId(casesList[0].case_id);
        }
      } catch (err) {
        console.error('Failed to fetch cases:', err);
      }
    }
    initCases();
  }, []);

  // Listen for 401 unauthorized events from API interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setShowLoginModal(true);
    };
    window.addEventListener('nettrace:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nettrace:unauthorized', handleUnauthorized);
  }, [setShowLoginModal]);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        {/* Sidebar only shown when workspace is active */}
        {hasUploadedData && <Sidebar />}

        <main className={`flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] ${hasUploadedData ? 'p-6' : ''}`}>
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'deep_investigation' && hasUploadedData && <DeepInvestigationView />}
          {activeView === 'party_analysis' && hasUploadedData && <PartyAnalysisView />}
          {activeView === 'duration_analysis' && hasUploadedData && <DurationAnalysisView />}
          {activeView === 'network' && hasUploadedData && <LinkAnalysis />}
          {activeView === 'gis' && hasUploadedData && <GeoSpatialView />}
          {activeView === 'forensics' && hasUploadedData && <ForensicsReportView />}
          {activeView === 'ipdr' && hasUploadedData && <IPDRView />}
          {activeView === 'speech' && hasUploadedData && <SpeechOCRView />}
          {activeView === 'officers' && hasUploadedData && <OfficerManagementView />}
        </main>
      </div>

      <UploadModal />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#090d16] border border-cyan-500/50 text-cyan-300 px-4 py-3 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 animate-bounce">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
