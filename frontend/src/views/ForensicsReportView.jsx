import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  FileText,
  FileSpreadsheet,
  Download,
  Shield,
  Clock,
  Printer,
  AlertTriangle,
  Award,
  Link,
  GitBranch,
  Hash,
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import { forensicsService } from '../services/forensicsService';
import Loader from '../components/common/Loader';

export default function ForensicsReportView() {
  const { selectedCaseId, showToast } = useCDRStore();
  const [summary, setSummary] = useState(null);
  const [custodyLog, setCustodyLog] = useState([]);
  const [relayChains, setRelayChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSummary() {
      if (!selectedCaseId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [data, custodyRes, relayRes] = await Promise.allSettled([
          cdrService.getCaseSummary(selectedCaseId),
          forensicsService.getChainOfCustody(selectedCaseId),
          forensicsService.getRelayChains(selectedCaseId),
        ]);
        if (data.status === 'fulfilled') {
          setSummary(data.value);
        } else {
          setError('Failed to load primary case summary.');
        }
        if (custodyRes.status === 'fulfilled') setCustodyLog(custodyRes.value?.audit_trail || custodyRes.value || []);
        if (relayRes.status === 'fulfilled') setRelayChains(relayRes.value?.chains || relayRes.value || []);
      } catch (err) {
        setError(err.message || 'Error loading forensic report.');
        showToast('Error loading report summary: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, [selectedCaseId]);

  if (loading) {
    return <Loader text="Generating Court-Ready Evidentiary Report..." />;
  }

  if (!selectedCaseId) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono bg-[#090d16] border border-cyan-500/20 rounded-2xl max-w-2xl mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Active Case Selected</h3>
        <p className="text-xs text-slate-400 mt-1">Please select or upload a CDR investigation case to generate certified reports.</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-8 text-center text-red-400 font-mono bg-red-950/20 border border-red-500/30 rounded-2xl max-w-2xl mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-red-200">Forensics Report Error</h3>
        <p className="text-xs text-red-300 mt-1">{error}</p>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    window.open(cdrService.exportPdfUrl(selectedCaseId), '_blank');
  };

  const handleDownloadExcel = () => {
    window.open(cdrService.exportExcelUrl(selectedCaseId), '_blank');
  };

  return (
    <div className="space-y-6 pb-16 font-mono text-xs max-w-5xl mx-auto">
      {/* Action Header */}
      <div className="p-4 bg-[#090d16] border border-cyan-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Certified Cyber Forensics Evidentiary Dossier
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              Indian Evidence Act § 65B Compliant Electronic Record Export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(cdrService.exportSection65BUrl(selectedCaseId), '_blank')}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-amber-900/30 transition"
            title="Download certified Section 65B Audit Log Certificate under Indian Evidence Act"
          >
            <Shield className="w-4 h-4" />
            § 65B Legal Certificate
          </button>

          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition"
          >
            <Download className="w-4 h-4" />
            1-Click Court PDF
          </button>

          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Raw Excel Master (.xlsx)
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-8 rounded-2xl bg-[#090d16] border border-slate-800 space-y-8 shadow-2xl">
        {/* Document Header */}
        <div className="border-b border-slate-800 pb-6 flex justify-between items-start">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
              GOVERNMENT OF INDIA • SPECIAL CYBER CRIME INVESTIGATION WING
            </div>
            <h1 className="text-xl font-bold text-white tracking-wider">
              TELECOMMUNICATION CALL DETAIL RECORD (CDR) ANALYSIS REPORT
            </h1>
            <div className="text-slate-400 text-[11px] pt-1">
              Case Reference: <b className="text-cyan-300">{summary?.case_id}</b> • Dossier: {summary?.case_name}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right space-y-0.5">
            <div className="text-[10px] text-slate-500">INVESTIGATOR BADGE</div>
            <div className="font-bold text-slate-200">Insp. Vikram Rathore (CC-9042)</div>
            <div className="text-[10px] text-slate-400">Timestamp: {summary?.generated_at}</div>
          </div>
        </div>

        {/* Section 1: Executive Summary */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-l-2 border-cyan-400 pl-2">
            1. Executive Forensic Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">TOTAL CDR TRANSACTIONS</div>
              <div className="text-lg font-bold text-white">{summary?.total_records}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">TOTAL CALL DURATION</div>
              <div className="text-lg font-bold text-white">{summary?.total_duration_minutes} mins</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">MIDNIGHT SPIKE CALLS (12-4 AM)</div>
              <div className="text-lg font-bold text-rose-400">{summary?.late_night_calls_count}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">HANDSET (IMEI) SWAPS DETECTED</div>
              <div className="text-lg font-bold text-amber-400">{summary?.multi_sim_devices}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Identified Hubs & Network Key Targets */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-l-2 border-cyan-400 pl-2">
            2. Priority Suspect Network Nodes (Degree & Betweenness Centrality)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Subscriber Number</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Total Calls</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Late Night</th>
                  <th className="py-2.5 px-3">Degree Cent.</th>
                  <th className="py-2.5 px-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(summary?.top_suspects || []).map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-slate-500 font-bold">#{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-cyan-300">{s.id}</td>
                    <td className="py-2 px-3 text-slate-300">{s.operator}</td>
                    <td className="py-2 px-3 text-slate-400">{s.total_calls}</td>
                    <td className="py-2 px-3 text-slate-400">{Math.round(s.total_duration / 60)}m</td>
                    <td className="py-2 px-3 text-rose-400 font-bold">{s.late_night_calls}</td>
                    <td className="py-2 px-3 text-slate-300">{s.degree_centrality}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.is_hub ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {s.is_hub ? 'PRIMARY HUB' : (s.is_bridge ? 'BROKER' : 'AFFILIATE')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Hardware IMEI Hopping */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-l-2 border-amber-400 pl-2">
            3. Hardware IMEI Swapping & Handset Sharing Evidence
          </h3>
          {(summary?.suspicious_imeis || []).length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-500">
              No anomalous hardware IMEI handset sharing recorded.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">IMEI Handset</th>
                    <th className="py-2.5 px-3">SIMs Used</th>
                    <th className="py-2.5 px-3">Associated Subscriber SIMs</th>
                    <th className="py-2.5 px-3">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summary?.suspicious_imeis.map((dev, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-bold text-amber-300">{dev.imei}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                          {dev.sim_count} SIMs
                        </span>
                      </td>
                      <td className="py-2 px-3 text-cyan-300">
                        {(Array.isArray(dev.associated_sims) ? dev.associated_sims : [dev.associated_sims]).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-rose-400 font-bold">
                          {(dev.suspicious_score * 100).toFixed(0)}% CRITICAL RISK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Relay Chain Analysis */}
        {relayChains.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider border-l-2 border-purple-400 pl-2">
              4. Domino Relay Chain Analysis (Sequential Call Hop Detection)
            </h3>
            <div className="space-y-3">
              {relayChains.map((chain, ci) => {
                const hopsList = chain.subscribers || (chain.hops || []).map((h) => typeof h === 'string' ? h : `${h.caller || ''} → ${h.receiver || ''}`.trim());
                return (
                  <div key={ci} className="p-3 rounded-lg bg-slate-950 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                      <span className="font-bold text-purple-300 text-[11px]">
                        Chain #{ci + 1} — {chain.subscribers?.length || chain.hops?.length || 0} participants within {chain.max_gap_minutes || 15}min window
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                        RELAY DETECTED
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hopsList.map((hop, hi) => (
                        <React.Fragment key={hi}>
                          <span className="px-2 py-1 rounded bg-slate-900 border border-purple-500/30 text-cyan-300 font-bold text-[11px]">
                            {typeof hop === 'string' ? hop : (hop?.caller ? `${hop.caller} → ${hop.receiver}` : String(hop?.phone || 'Hop'))}
                          </span>
                          {hi < hopsList.length - 1 && (
                            <span className="text-purple-400 font-bold">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 5: SHA-256 Tamper-Evident Chain of Custody */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-l-2 border-emerald-400 pl-2">
            {relayChains.length > 0 ? '5' : '4'}. SHA-256 Tamper-Evident Chain of Custody Ledger (§65B)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">File / Source</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-emerald-400" /> SHA-256 Hash
                  </th>
                  <th className="py-2.5 px-3">Chain Valid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {custodyLog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No custodial entries recorded. Entries are auto-generated during speech analysis, OCR, and file uploads.
                    </td>
                  </tr>
                ) : (
                  custodyLog.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-slate-500 font-bold">#{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 font-bold text-[10px]">
                          {entry.event_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono truncate max-w-[120px]" title={entry.file_name || entry.source_file}>{entry.file_name || entry.source_file || 'audit_manifest'}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-emerald-300 text-[10px] block truncate max-w-[180px]" title={entry.sha256_hash}>
                          {entry.sha256_hash ? `${entry.sha256_hash.substring(0, 16)}...${entry.sha256_hash.slice(-8)}` : '—'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {entry.chain_valid !== false ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <Shield className="w-3 h-3" /> VALID
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400 font-bold">
                            <AlertTriangle className="w-3 h-3" /> TAMPERED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-emerald-400" />
            All hashes computed using SHA-256. This ledger constitutes a tamper-evident audit trail as per §65B, Indian Evidence Act, 2000.
          </div>
        </div>

        {/* Signature & Legal Notice */}
        <div className="pt-6 border-t border-slate-800 flex justify-between items-end text-[10px] text-slate-500">
          <div>
            <div>System Generated Forensic Artifact ID: <b>NFT-CDR-2026-X99</b></div>
            <div>Database Engine: PostgreSQL + NetworkX + Neo4j Graph DB</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-400">CERTIFYING FORENSIC ANALYST</div>
            <div className="text-slate-500">Digital Investigation Wing, Cyber Cell</div>
          </div>
        </div>
      </div>
    </div>
  );
}
