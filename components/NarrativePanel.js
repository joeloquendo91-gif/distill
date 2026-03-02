"use client";

export default function NarrativePanel({ narrative, onClose }) {
  return (
    <div className="mb-6 bg-[#f0fdf4] border border-green-200 rounded-2xl p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
        aria-label="Close"
      >
        ×
      </button>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-green-600 text-lg">✦</span>
        <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wider">
          AI Narrative
        </h3>
      </div>
      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{narrative}</p>
    </div>
  );
}
