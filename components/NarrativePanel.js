"use client";

export default function NarrativePanel({ narrative, onClose }) {
  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-950/60 to-violet-950/60 border border-indigo-500/20 rounded-2xl p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-lg leading-none"
        aria-label="Close"
      >
        ×
      </button>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-indigo-400 text-lg">✦</span>
        <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">
          AI Narrative
        </h3>
      </div>
      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">{narrative}</p>
    </div>
  );
}
