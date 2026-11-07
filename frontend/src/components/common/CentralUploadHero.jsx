import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Shield,
  Radio,
  Sparkles,
  ArrowRight,
  Database,
  Cpu,
  Lock,
  Layers,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';
import { cdrService } from '../../services/cdrService';

export default function CentralUploadHero({ onUploadSuccess }) {
  const { selectedCaseId, setSelectedCaseId, showToast, setHasUploadedData } = useCDRStore();
  const [caseId, setCaseId] = useState(selectedCaseId || 'CASE-DL-2026-904');
  const [operator, setOperator] = useState('AUTO');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const processingSteps = [
    'Parsing Heterogeneous Telecom CDR Headers...',
    'Normalizing E.164 MSISDNs, IMEIs & Timestamps...',
    'Constructing Network Graph & Calculating Centrality Hubs...',
    'Triangulating Cell Tower GIS Coordinates & Azimuths...',
    'Unlocking Unified Forensic Intelligence Workspace...'
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const runProcessingAnimation = () => {
    return new Promise((resolve) => {
      let step = 0;
      setProcessingStep(0);
      const interval = setInterval(() => {
        step += 1;
        if (step < processingSteps.length) {
          setProcessingStep(step);
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 700);
    });
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select or drop a CDR file (CSV, XLSX, TXT) to continue.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const formData = new FormData();
      formData.append('case_id', caseId);
      formData.append('operator', operator);
      formData.append('file', file);

      // Launch upload request and animation
      const [uploadRes] = await Promise.all([
        cdrService.uploadCDRFile(formData),
        runProcessingAnimation()
      ]);

      setSelectedCaseId(caseId);
      showToast(`Ingestion complete! ${uploadRes.valid_records} records normalized across ${uploadRes.operator_detected}.`);
      setHasUploadedData(true);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setIsProcessing(false);
      setError(err.response?.data?.detail || err.message || 'File ingestion failed');
    }
  };

  const handleQuickDemoLoad = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      const [seedRes] = await Promise.all([
        cdrService.seedDemoData(),
        runProcessingAnimation()
      ]);

      setSelectedCaseId(seedRes.case_id);
      showToast(`Demonstration case activated! ${seedRes.records_generated} transactions populated.`);
      setHasUploadedData(true);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setIsProcessing(false);
      setError('Failed to seed demonstration dataset: ' + err.message);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      {/* Tactical Ambient Background Grid & Radar Ping */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e172a_1px,transparent_1px),linear-gradient(to_bottom,#0e172a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Center Upload Box */}
      <div className="relative w-full max-w-2xl bg-[#090d16]/95 border border-cyan-500/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-cyan-950/40 transition-all duration-500 font-mono">
        {/* Box Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wider">
                  NETTRACE INVESTIGATION GATEWAY
                </h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                  EVIDENTIARY PARSER
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Airtel, Jio, and Vodafone Idea (VI) Heterogeneous Log Normalization
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            <Lock className="w-3 h-3 text-cyan-400" />
            <span>SECURE FORENSIC SESSION</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* PROCESSING STATE: High-tech radar analysis state */}
        {isProcessing ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="relative">
              {/* Outer pulsing ring */}
              <div className="w-24 h-24 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
              {/* Inner radar glow */}
              <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center animate-pulse">
                <Radio className="w-8 h-8 text-cyan-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-cyan-300 tracking-wide">
                ANALYZING TELECOM INTELLIGENCE
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto min-h-[20px] transition-all">
                {processingSteps[processingStep]}
              </p>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="flex items-center gap-2 pt-2">
              {processingSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx <= processingStep ? 'w-8 bg-cyan-400' : 'w-2 bg-slate-800'
                  }`}
                />
              ))}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest pt-2">
              Parsing Telecom Logs & Building Graph Network...
            </div>
          </div>
        ) : (
          /* INITIAL LANDING STATE: Central Drag & Drop Box */
          <div className="space-y-6">
            {/* Case ID & Operator Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  CASE REFERENCE ID
                </label>
                <input
                  type="text"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="e.g. CASE-DL-2026-904"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 focus:border-cyan-400 text-slate-200 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  OPERATOR FORMAT DETECTOR
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 focus:border-cyan-400 text-slate-200 outline-none text-xs"
                >
                  <option value="AUTO">Auto-Detect Telecom Format (Smart)</option>
                  <option value="AIRTEL">Bharti Airtel (CSV / XLSX)</option>
                  <option value="JIO">Reliance Jio (VoLTE / 5G)</option>
                  <option value="VI">Vodafone Idea - VI</option>
                </select>
              </div>
            </div>

            {/* Large Interactive Drag & Drop Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-slate-700/80 hover:border-cyan-500/60 bg-slate-950/50 hover:bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center mb-3 shadow-inner">
                {file ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 animate-bounce" />
                ) : (
                  <UploadCloud className="w-7 h-7 text-cyan-400 animate-pulse" />
                )}
              </div>

              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-emerald-300">File Selected: {file.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB • Ready for automated ingestion
                  </div>
                  <div className="text-[10px] text-cyan-400 pt-1 underline">Click to change file</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-base font-bold text-white tracking-wide">
                    Drag & Drop CDR CSV Files Here
                  </div>
                  <div className="text-xs text-slate-400 font-sans max-w-sm">
                    Upload heterogeneous telecom logs from Bharti Airtel, Jio, or VI
                  </div>
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition shadow-sm">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                      Browse Files (CSV, XLSX, TXT)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {/* Primary Analyze Button */}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!file}
                className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Activity className="w-4 h-4" />
                Analyze Intelligence & Unlock Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Secondary Demo Option */}
              <button
                type="button"
                onClick={handleQuickDemoLoad}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center justify-center gap-2 transition"
                title="Populate authentic Delhi-NCR Syndicate CDR dataset"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Load Sample Investigation
              </button>
            </div>

            {/* Bottom Form Note */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
              <span>Automatic Normalization: Calls, SMS, Tower CGI, GPS & IMEIs</span>
              <span>100% Client-Safe Evidentiary Pipeline</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
