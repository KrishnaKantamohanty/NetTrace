import React, { useState, useEffect } from 'react';
import { Shield, Upload, Play, FileText, Database, Radio, ChevronDown, Check, PlusCircle, RefreshCw } from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';
import { cdrService } from '../../services/cdrService';

export default function Navbar() {
  const { cases, setCases, selectedCaseId, setSelectedCaseId, setHasUploadedData, resetWorkspace, setIsUploadOpen, showToast } = useCDRStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    async function loadCases() {
      try {
        const list = await cdrService.getCases();
        if (list && list.length > 0) {
          setCases(list);
        }
      } catch (err) {
        console.warn('Could not load case list:', err);
      }
    }
    loadCases();
  }, []);

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      const res = await cdrService.seedDemoData();
      showToast(`Demonstration case loaded: ${res.records_generated} forensic transactions populated!`);
      setSelectedCaseId(res.case_id);
      setHasUploadedData(true);
      // Refresh case list
      const updated = await cdrService.getCases();
      if (updated) setCases(updated);
    } catch (err) {
      showToast('Error seeding demo data: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleExportPDF = () => {
    if (!selectedCaseId) return;
    window.open(cdrService.exportPdfUrl(selectedCaseId), '_blank');
  };

  return (
    <header className="h-16 bg-[#090d16]/90 border-b border-cyan-500/20 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-wider text-white font-mono">NetTrace</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-semibold">
                v2.4 FORENSIC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-tight font-sans">Telecom CDR Intelligence & GIS Link Engine</p>
          </div>
        </div>

        {/* Case Selector Dropdown */}
        <div className="relative ml-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-sm font-mono text-slate-200 transition"
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-cyan-300">{selectedCaseId || 'Select Case'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-lg bg-[#0e1424] border border-cyan-500/30 shadow-2xl py-2 z-50">
              <div className="px-3 py-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between items-center">
                <span>Active Investigations</span>
                <button
                  onClick={() => {
                    resetWorkspace();
                    setIsDropdownOpen(false);
                    showToast('Returned to Central Upload Gateway for new investigation.');
                  }}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] lowercase"
                  title="Start fresh investigation"
                >
                  <PlusCircle className="w-3 h-3" /> new
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {cases.map((c) => (
                  <button
                    key={c.case_id}
                    onClick={() => {
                      setSelectedCaseId(c.case_id);
                      setHasUploadedData(true);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between hover:bg-cyan-950/40 ${
                      selectedCaseId === c.case_id ? 'text-cyan-400 bg-cyan-950/20 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{c.case_id}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{c.case_name}</div>
                    </div>
                    {selectedCaseId === c.case_id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 text-xs font-mono font-medium transition shadow-sm"
          title="Pre-populate realistic Airtel, Jio & VI CDR investigation dataset"
        >
          <Play className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
          {seeding ? 'Seeding Data...' : 'Load Sample Case'}
        </button>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-semibold transition shadow-md shadow-cyan-900/30"
        >
          <Upload className="w-3.5 h-3.5" />
          Ingest CDR
        </button>

        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition"
          title="Download Court-Ready Certified Forensic Evidence PDF"
        >
          <FileText className="w-3.5 h-3.5 text-rose-400" />
          Court PDF
        </button>

        <button
          onClick={() => {
            if (!selectedCaseId) return;
            window.open(cdrService.exportSection65BUrl(selectedCaseId), '_blank');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/40 text-xs font-mono font-medium transition shadow-sm"
          title="Download Legal Section 65B Certificate of Electronic Evidence PDF"
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          § 65B Certificate
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1"></div>

        {/* Officer Badge */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-mono font-semibold text-slate-200">CC-9042</div>
            <div className="text-[10px] text-cyan-400 font-mono">CYBER SPECIAL CELL</div>
          </div>
        </div>
      </div>
    </header>
  );
}
