"use client";

export default function NarrativePanel({ narrative, onClose }) {
  return (
    <div className="mb-6 bg-green-950/30 border border-green-700/30 rounded-2xl p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-200 text-lg leading-none"
        aria-label="Close"
      >
        ×
      </button>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-green-400 text-lg">✦</span>
        <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">
          AI Narrative
        </h3>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{narrative}</p>
    </div>
  );
}
