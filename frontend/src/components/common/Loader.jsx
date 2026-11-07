import React from 'react';
import { Radio } from 'lucide-react';

export default function Loader({ text = "Processing forensic data..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
        <Radio className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <p className="text-xs font-mono text-cyan-400/80 tracking-wide uppercase">{text}</p>
    </div>
  );
}
