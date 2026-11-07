import React, { useState, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Radio } from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';

export default function UploadModal() {
  const {
    isUploadOpen,
    setIsUploadOpen,
    selectedCaseId,
    setSelectedCaseId,
    setHasUploadedData,
    setCases,
    showToast
  } = useCDRStore();
  const [caseId, setCaseId] = useState(selectedCaseId || 'CASE-DL-2026-904');
  const [operator, setOperator] = useState('AUTO');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUploadOpen(false);
        setResult(null);
      }
    };
    if (isUploadOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploadOpen, setIsUploadOpen]);

  if (!isUploadOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleClose = () => {
    setIsUploadOpen(false);
    setResult(null);
    setFile(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CDR file (CSV, XLSX, or TXT) to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('case_id', caseId);
      formData.append('operator', operator);
      formData.append('file', file);

      const res = await cdrService.uploadCDRFile(formData);
      setResult(res);
      showToast(`Ingestion complete! ${res.valid_records} CDR records normalized and stored.`);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to ingest file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
    >
      <div className="bg-[#0b0f19] border border-cyan-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm tracking-wide">
              MULTI-FORMAT TELECOM CDR INGESTION ENGINE
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>{error}</div>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Ingestion Completed Successfully
              </div>
              <div className="text-[11px] space-y-1 text-slate-300">
                <div>Detected Operator: <b className="text-cyan-300">{result.operator_detected}</b></div>
                <div>Normalized Records: <b className="text-emerald-400">{result.valid_records}</b></div>
                <div>Skipped / Header lines: <b>{result.skipped_records}</b></div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSelectedCaseId(caseId);
                  setHasUploadedData(true);
                  handleClose();
                  try {
                    const list = await cdrService.getCases();
                    if (list && list.length > 0) setCases(list);
                  } catch (e) {
                    console.warn('Failed to refresh cases list:', e);
                  }
                }}
                className="mt-2 w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                Done & View Workspace
              </button>
            </div>
          )}

          {!result && (
            <>
              {/* Case ID */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Investigation Case ID
                </label>
                <input
                  type="text"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  required
                  placeholder="e.g. CASE-DL-2026-904"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-slate-200 outline-none"
                />
              </div>

              {/* Operator Selector */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Telecom Provider Format
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-slate-200 outline-none"
                >
                  <option value="AUTO">Auto-Detect Telecom Format (Recommended)</option>
                  <option value="AIRTEL">Bharti Airtel (CSV / XLSX / TXT)</option>
                  <option value="JIO">Reliance Jio (CSV / XLSX / TXT)</option>
                  <option value="VI">Vodafone Idea - VI (CSV / XLSX / TXT)</option>
                </select>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  CDR Dataset File (.csv, .xlsx, .txt)
                </label>
                <label className="border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/60">
                  <FileSpreadsheet className="w-8 h-8 text-cyan-400 mb-2" />
                  <span className="text-slate-300 font-medium">
                    {file ? file.name : 'Click or drag CDR spreadsheet here'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Accepts raw operator exports from Airtel, Jio, VI
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Parsing & Normalizing CDR...' : 'Start Ingestion Pipeline'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
