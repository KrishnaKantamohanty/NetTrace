import React, { useEffect, useState } from 'react';
import {
  Mic, FileText, Eye, Search, AlertTriangle, CheckCircle,
  Clock, Volume2, ChevronDown, ChevronUp, X, Send,
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { forensicsService } from '../services/forensicsService';
import Loader from '../components/common/Loader';

const CRIME_KEYWORDS = ['paisa', 'maal', 'hawala', 'consignment', 'delivery', 'parcel', 'khata', 'raqam', 'samaan'];

function highlightKeywords(text) {
  if (!text) return '—';
  const parts = text.split(new RegExp(`(${CRIME_KEYWORDS.join('|')})`, 'gi'));
  return parts.map((part, i) =>
    CRIME_KEYWORDS.some((kw) => kw.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} className="bg-rose-500/30 text-rose-300 px-0.5 rounded font-bold not-italic">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function TranscriptCard({ record, expanded, onToggle }) {
  // Backend fields: caller, receiver, transcription_raw, flagged_keywords, language_detected, threat_severity, timestamp
  const flags = record.flagged_keywords || record.crime_keywords_found || [];
  const hasFlags = flags.length > 0;
  const transcript = record.transcription_raw || record.transcript;
  const caller = record.caller || record.caller_number;
  const receiver = record.receiver || record.receiver_number;
  const ts = record.timestamp || record.recorded_at;
  const lang = record.language_detected || record.language;
  const severity = record.threat_severity || record.confidence_score;
  return (
    <div className={`rounded-xl border ${hasFlags ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-700/80 bg-slate-900/30'} overflow-hidden`}>
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {hasFlags ? (
            <div className="w-8 h-8 rounded-full bg-rose-950 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 text-slate-400" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-cyan-300">{caller}</span>
              <span className="text-slate-500">→</span>
              <span className="text-emerald-300">{receiver}</span>
              {hasFlags && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 text-[10px] font-bold">
                  KEYWORDS: {flags.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {ts ? new Date(ts).toLocaleString('en-IN') : '—'}
              </span>
              <span>Lang: <b className="text-slate-300">{lang}</b></span>
              <span>Severity: <b className="text-amber-300">{severity || '—'}</b></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Volume2 className="w-3 h-3" />
            {record.audio_url || record.audio_filename || 'audio_intercept.wav'}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/60 pt-3 space-y-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">AI Transcript</div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[12px] text-slate-300 leading-relaxed font-sans italic">
            "{highlightKeywords(transcript)}"
          </div>
          {record.translation_english && (
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <span className="text-slate-500 font-bold">English: </span>{record.translation_english}
            </div>
          )}
          {hasFlags && (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300">
              <b>Flagged Crime Keywords:</b>{' '}
              {flags.map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700 font-bold mr-1">{kw}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OCRDocumentCard({ doc, expanded, onToggle }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#090d16] overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              {doc.doc_type || 'Document'}
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 text-[10px]">
                {doc.document_filename}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Scanned: {doc.scanned_at ? new Date(doc.scanned_at).toLocaleString('en-IN') : '—'} •
              Script: <b className="text-cyan-300">{doc.detected_script || 'Multi-script'}</b>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/60 pt-3 space-y-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[12px] text-slate-300 leading-relaxed font-sans max-h-48 overflow-y-auto">
            {doc.extracted_text || 'No text extracted.'}
          </div>

          {doc.extracted_entities && (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Extracted Entities</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {doc.extracted_entities.phone_numbers?.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase mb-1">Phone Numbers</div>
                    {doc.extracted_entities.phone_numbers.map((p, i) => (
                      <div key={i} className="text-[11px] text-cyan-300 font-bold">{p}</div>
                    ))}
                  </div>
                )}
                {doc.extracted_entities.imei_numbers?.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase mb-1">IMEI Numbers</div>
                    {doc.extracted_entities.imei_numbers.map((im, i) => (
                      <div key={i} className="text-[11px] text-amber-300 font-bold">{im}</div>
                    ))}
                  </div>
                )}
                {doc.extracted_entities.locations?.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase mb-1">Locations</div>
                    {doc.extracted_entities.locations.map((loc, i) => (
                      <div key={i} className="text-[11px] text-emerald-300">{loc}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpeechOCRView() {
  const { selectedCaseId, showToast } = useCDRStore();
  const [intercepts, setIntercepts] = useState([]);
  const [ocrDocs, setOcrDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('speech');
  const [expandedId, setExpandedId] = useState(null);

  const [quickAnalyzeOpen, setQuickAnalyzeOpen] = useState(false);
  const [qaForm, setQaForm] = useState({ caller: '', receiver: '', transcript: '', language: 'Hindi' });
  const [qaLoading, setQaLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!selectedCaseId) return;
      try {
        setLoading(true);
        const [speechRes, ocrRes] = await Promise.allSettled([
          forensicsService.getSpeechIntercepts(selectedCaseId),
          forensicsService.getOCRDocuments(selectedCaseId),
        ]);
        if (speechRes.status === 'fulfilled') {
          // Backend returns array directly (not wrapped in .intercepts)
          const raw = speechRes.value;
          setIntercepts(Array.isArray(raw) ? raw : (raw?.intercepts || []));
        }
        if (ocrRes.status === 'fulfilled') {
          const raw = ocrRes.value;
          setOcrDocs(Array.isArray(raw) ? raw : (raw?.documents || []));
        }
      } catch (err) {
        showToast('Error loading speech/OCR data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedCaseId]);

  const handleQuickAnalyze = async () => {
    if (!selectedCaseId) {
      showToast('No case selected. Please select or create a case first.');
      return;
    }
    if (!qaForm.caller || !qaForm.receiver) {
      showToast('Please fill caller and receiver numbers.');
      return;
    }
    try {
      setQaLoading(true);
      const fd = new FormData();
      fd.append('case_id', selectedCaseId);
      fd.append('caller', qaForm.caller);
      fd.append('receiver', qaForm.receiver);
      fd.append('transcript', qaForm.transcript);
      fd.append('language', qaForm.language);
      const res = await forensicsService.analyzeSpeech(fd);
      showToast('Speech analyzed! Keywords: ' + (res.flagged_keywords?.join(', ') || res.crime_keywords?.join(', ') || 'None'));
      // Refresh list
      const updated = await forensicsService.getSpeechIntercepts(selectedCaseId);
      setIntercepts(updated?.intercepts || updated || []);
      setQuickAnalyzeOpen(false);
    } catch (err) {
      showToast('Analysis failed: ' + err.message);
    } finally {
      setQaLoading(false);
    }
  };

  if (loading) return <Loader text="Loading Speech Intercepts & OCR Documents..." />;

  const flaggedCount = intercepts.filter((r) => r.crime_keywords_found?.length > 0).length;

  return (
    <div className="space-y-5 pb-16 font-mono text-xs">
      {/* Header */}
      <div className="p-4 bg-[#090d16] border border-purple-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-950 border border-purple-500/40">
            <Mic className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Speech Forensics & Multi-Script OCR
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              AI Whisper Transcription • Crime Keyword Spotting • Police FIR / SIM Form OCR
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuickAnalyzeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/50 hover:bg-purple-800/60 text-purple-300 border border-purple-500/40 transition font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            Quick Analyze
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Intercepts', value: intercepts.length, cls: 'text-purple-400' },
          { label: 'Flagged Calls', value: flaggedCount, cls: 'text-rose-400' },
          { label: 'OCR Documents', value: ocrDocs.length, cls: 'text-cyan-400' },
          { label: 'Languages', value: [...new Set(intercepts.map((r) => r.language))].length || 1, cls: 'text-emerald-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2">
        {[
          { id: 'speech', label: 'Audio Intercepts', icon: <Mic className="w-3.5 h-3.5" /> },
          { id: 'ocr', label: 'OCR Documents', icon: <Eye className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition text-xs ${
              activeTab === tab.id
                ? 'bg-purple-950 text-purple-300 border border-purple-500/50'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Speech Intercepts */}
      {activeTab === 'speech' && (
        <div className="space-y-3">
          {flaggedCount > 0 && (
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-2 text-[11px] text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <b>{flaggedCount} calls</b> flagged with crime-related keywords (hawala, maal, consignment, paisa). Transcripts highlighted below.
              </span>
            </div>
          )}
          {intercepts.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-[#090d16] text-center text-slate-500">
              No audio intercepts recorded. Use "Quick Analyze" to submit tapped call transcripts.
            </div>
          ) : (
            intercepts.map((r, i) => (
              <TranscriptCard
                key={i}
                record={r}
                expanded={expandedId === i}
                onToggle={() => setExpandedId(expandedId === i ? null : i)}
              />
            ))
          )}
        </div>
      )}

      {/* OCR Documents */}
      {activeTab === 'ocr' && (
        <div className="space-y-3">
          {ocrDocs.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-[#090d16] text-center text-slate-500">
              No OCR documents scanned. Upload scanned FIRs or SIM application forms to extract data.
            </div>
          ) : (
            ocrDocs.map((doc, i) => (
              <OCRDocumentCard
                key={i}
                doc={doc}
                expanded={expandedId === `ocr-${i}`}
                onToggle={() => setExpandedId(expandedId === `ocr-${i}` ? null : `ocr-${i}`)}
              />
            ))
          )}
        </div>
      )}

      {/* Quick Analyze Modal */}
      {quickAnalyzeOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl font-mono text-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-slate-100">Quick Speech Analysis</h3>
              </div>
              <button onClick={() => setQuickAnalyzeOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Caller Number</label>
                  <input
                    type="text"
                    value={qaForm.caller}
                    onChange={(e) => setQaForm({ ...qaForm, caller: e.target.value })}
                    placeholder="9811012345"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Receiver Number</label>
                  <input
                    type="text"
                    value={qaForm.receiver}
                    onChange={(e) => setQaForm({ ...qaForm, receiver: e.target.value })}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Language</label>
                <select
                  value={qaForm.language}
                  onChange={(e) => setQaForm({ ...qaForm, language: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                >
                  {['Hindi', 'English', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Urdu', 'Marathi'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Transcript Text (simulated / manual entry)</label>
                <textarea
                  value={qaForm.transcript}
                  onChange={(e) => setQaForm({ ...qaForm, transcript: e.target.value })}
                  rows={4}
                  placeholder="e.g. Bhai kal tak paisa transfer kar do, maal ready hai..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none resize-none font-sans"
                />
              </div>
              <button
                onClick={handleQuickAnalyze}
                disabled={qaLoading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {qaLoading ? 'Analyzing with AI Whisper...' : 'Run Keyword Spotting Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
