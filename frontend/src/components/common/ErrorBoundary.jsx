import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("NetTrace Runtime UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-6 font-mono">
          <div className="max-w-lg w-full bg-[#090d16] border border-rose-500/40 rounded-2xl p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-950/60 border border-rose-500/50 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white uppercase tracking-wider">
                Forensics UI Render Exception
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                A component error was caught safely. Click below to recover the workspace.
              </p>
            </div>
            <div className="p-3 bg-black/50 border border-slate-800 rounded-lg text-[11px] text-rose-300 text-left font-mono overflow-x-auto max-h-32">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Platform
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
