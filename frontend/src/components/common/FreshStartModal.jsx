import React, { useState } from 'react';
import {
  AlertTriangle,
  FolderPlus,
  Trash2,
  AlertOctagon,
  X,
  CheckCircle,
  Download,
  ShieldAlert,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';
import { cdrService } from '../../services/cdrService';

export default function FreshStartModal({ isOpen, onClose }) {
  const {
    cases,
    setCases,
    selectedCaseId,
    setSelectedCaseId,
    setHasUploadedData,
    resetWorkspace,
    showToast,
  } = useCDRStore();

  const [activeTab, setActiveTab] = useState('new'); // 'new', 'clear_case', 'admin_reset'
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form states for 'new'
  const [newCaseId, setNewCaseId] = useState(`CASE-DL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [newCaseName, setNewCaseName] = useState('');
  const [investigatorName, setInvestigatorName] = useState('Insp. R. Sharma (CC-9042)');
  const [newDescription, setNewDescription] = useState('');

  // Form states for 'clear_case'
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [preserveMetadata, setPreserveMetadata] = useState(true);

  // Form states for 'admin_reset'
  const [adminConfirmPhrase, setAdminConfirmPhrase] = useState('');
  const [adminBadge, setAdminBadge] = useState('ADM-001');

  if (!isOpen) return null;

  // Handler: Start New Investigation
  const handleStartNew = async (e) => {
    e.preventDefault();
    if (!newCaseId.trim()) return;

    try {
      setLoading(true);
      setStatusMessage('Initializing new clean investigation container...');
      const payload = {
        case_id: newCaseId.trim(),
        case_name: newCaseName.trim() || `Investigation ${newCaseId}`,
        investigator_name: investigatorName.trim(),
        description: newDescription.trim() || 'Initialized via NetTrace Fresh Start Module',
      };

      await cdrService.startNewInvestigation(payload);
      
      // Update case list and select new case
      const updatedList = await cdrService.getCases();
      setCases(updatedList);
      setSelectedCaseId(payload.case_id);
      setHasUploadedData(false); // Return to central upload hero for the new case

      showToast(`Fresh Case "${payload.case_id}" created successfully. Ready for CDR ingestion.`);
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handler: Clear Current Case Data
  const handleClearCaseData = async (e) => {
    e.preventDefault();
    if (clearConfirmationText.trim() !== selectedCaseId) {
      setStatusMessage(`Please type "${selectedCaseId}" exactly to confirm deletion.`);
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(`Purging telecommunication records & graph nodes for ${selectedCaseId}...`);
      
      const res = await cdrService.clearInvestigationData(
        selectedCaseId,
        preserveMetadata,
        'CC-9042'
      );

      // Refresh case list
      const updatedList = await cdrService.getCases();
      setCases(updatedList);
      setHasUploadedData(false);

      showToast(`Investigation ${selectedCaseId} cleared: ${res.records_deleted || 0} CDR records removed.`);
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Error clearing case: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handler: Admin Reset All Cases
  const handleAdminReset = async (e) => {
    e.preventDefault();
    if (adminConfirmPhrase.trim() !== 'RESET_ALL_CASES') {
      setStatusMessage('You must type "RESET_ALL_CASES" to execute administrative reset.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage('Executing system-wide administrative reset and graph purge...');
      
      const res = await cdrService.adminResetAllCases(adminConfirmPhrase, adminBadge);
      
      resetWorkspace();
      setCases([]);
      setSelectedCaseId('');

      showToast(`Administrative reset complete: ${res.total_records_purged || 0} records across all cases removed.`);
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Reset failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#090d16] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono tracking-wide">
                Fresh Start / Case Lifecycle Manager
              </h2>
              <p className="text-xs text-slate-400">
                Manage investigation boundaries, clear records, or initialize fresh operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 text-xs font-mono">
          <button
            onClick={() => { setActiveTab('new'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 font-semibold transition ${
              activeTab === 'new'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>Option A: Start New Investigation</span>
          </button>

          <button
            onClick={() => { setActiveTab('clear_case'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 font-semibold transition ${
              activeTab === 'clear_case'
                ? 'border-amber-400 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Option B: Clear Current Case</span>
          </button>

          <button
            onClick={() => { setActiveTab('admin_reset'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 font-semibold transition ${
              activeTab === 'admin_reset'
                ? 'border-rose-500 text-rose-400 bg-rose-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Option C: Admin Reset</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {statusMessage && (
            <div className="mb-4 p-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB A: Start New Investigation */}
          {activeTab === 'new' && (
            <form onSubmit={handleStartNew} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-cyan-400 font-mono">Clean Container Initialization</div>
                <p>
                  Creates an isolated new investigation container with dedicated metadata, chain-of-custody logging, and empty graph workspace.
                  Existing cases remain completely untouched.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  New Case Identifier (Unique ID) *
                </label>
                <input
                  type="text"
                  required
                  value={newCaseId}
                  onChange={(e) => setNewCaseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs font-mono text-white outline-none"
                  placeholder="e.g. CASE-MH-2026-102"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Investigation Title / FIR Number
                </label>
                <input
                  type="text"
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs text-white outline-none"
                  placeholder="e.g. Operation Nightshade - Cross Border Cyber Extortion"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Investigating Officer / Badge
                  </label>
                  <input
                    type="text"
                    value={investigatorName}
                    onChange={(e) => setInvestigatorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Police Station / Cell
                  </label>
                  <input
                    type="text"
                    defaultValue="Cyber Crime Special Cell, Zone-1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-400 outline-none"
                    disabled
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Case Brief / Operational Notes
                </label>
                <textarea
                  rows="2"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs text-white outline-none"
                  placeholder="Suspect CDR target numbers, FIR section references..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-semibold transition shadow-md shadow-cyan-900/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  <span>Initialize & Switch to Case</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB B: Clear Current Case */}
          {activeTab === 'clear_case' && (
            <form onSubmit={handleClearCaseData} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold font-mono text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Selective Purge: Active Case &quot;{selectedCaseId}&quot;</span>
                </div>
                <p>
                  This will permanently delete all ingested CDR records, parsed tower locations, and Neo4j graph nodes associated with{' '}
                  <span className="font-mono font-bold text-white">{selectedCaseId}</span>.
                </p>
                <p className="text-[11px] text-amber-300/80">
                  ✓ Other investigations remain completely safe.<br />
                  ✓ Chain-of-custody audit trail preserves this deletion event with timestamp &amp; officer badge.
                </p>
              </div>

              {/* Pre-deletion evidence export safeguard */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-200 font-semibold">Evidence Backup Safeguard</div>
                  <div className="text-[11px] text-slate-400">Export current CDR records to Excel or PDF before purging.</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(cdrService.exportExcelUrl(selectedCaseId), '_blank')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Backup Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(cdrService.exportPdfUrl(selectedCaseId), '_blank')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-mono"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Court PDF</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="preserve_meta"
                  checked={preserveMetadata}
                  onChange={(e) => setPreserveMetadata(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900"
                />
                <label htmlFor="preserve_meta" className="text-xs text-slate-300 font-mono">
                  Preserve Case Metadata shell (keep case container open for new uploads)
                </label>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Type <span className="text-amber-400 font-bold select-all">{selectedCaseId}</span> to confirm deletion:
                </label>
                <input
                  type="text"
                  required
                  value={clearConfirmationText}
                  onChange={(e) => setClearConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-500/40 focus:border-amber-400 text-xs font-mono text-amber-200 outline-none"
                  placeholder={`Type "${selectedCaseId}" here`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || clearConfirmationText !== selectedCaseId}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono font-semibold transition shadow-md shadow-amber-900/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Clear Case Telecommunications Data</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB C: Administrative Data Reset */}
          {activeTab === 'admin_reset' && (
            <form onSubmit={handleAdminReset} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-2">
                <div className="flex items-center gap-2 font-bold font-mono text-rose-400">
                  <AlertOctagon className="w-4 h-4" />
                  <span>DANGER: Complete Administrative Forensic Purge</span>
                </div>
                <p>
                  This operation deletes <span className="font-bold underline">ALL CDR records across ALL cases</span>, clears all nodes and edges from the Neo4j telecom graph, and resets all case workspaces.
                </p>
                <p className="text-[11px] text-rose-300/80">
                  ⚠️ This action is irrevocable. It is intended only for authorized system administrators re-commissioning an analytical node.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Admin Badge / Authority Token *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminBadge}
                    onChange={(e) => setAdminBadge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-rose-500 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    System Node
                  </label>
                  <input
                    type="text"
                    defaultValue="NETTRACE-FORENSIC-SRV-01"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-400 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Type <span className="text-rose-400 font-bold select-all">RESET_ALL_CASES</span> to authorize destruction:
                </label>
                <input
                  type="text"
                  required
                  value={adminConfirmPhrase}
                  onChange={(e) => setAdminConfirmPhrase(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-rose-500/50 focus:border-rose-400 text-xs font-mono text-rose-300 outline-none"
                  placeholder="Type RESET_ALL_CASES here"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || adminConfirmPhrase !== 'RESET_ALL_CASES'}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono font-semibold transition shadow-md shadow-rose-900/40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertOctagon className="w-4 h-4" />}
                  <span>Execute Administrative Reset</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

