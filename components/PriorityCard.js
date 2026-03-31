"use client";
import { useState } from "react";

const PRIORITY_STYLES = {
  high:   { badge: "bg-red-50 text-red-600 border border-red-100",    dot: "bg-red-500" },
  medium: { badge: "bg-amber-50 text-amber-600 border border-amber-100", dot: "bg-amber-500" },
  watch:  { badge: "bg-gray-100 text-gray-500 border border-gray-200",  dot: "bg-gray-400" },
};

const CONFIDENCE_STYLES = {
  high:   "text-green-600",
  medium: "text-amber-600",
  low:    "text-gray-400",
};

export default function PriorityCard({ priority, index }) {
  const [expanded, setExpanded] = useState(false);

  const pStyle = PRIORITY_STYLES[priority.priority] || PRIORITY_STYLES.watch;
  const cColor = CONFIDENCE_STYLES[priority.confidence] || CONFIDENCE_STYLES.low;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-xs font-bold text-gray-400 mt-0.5 shrink-0">#{index + 1}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{priority.title}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${pStyle.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
                {priority.priority.charAt(0).toUpperCase() + priority.priority.slice(1)} priority
              </span>
              <span className={`text-[11px] font-medium ${cColor}`}>
                {priority.confidence.charAt(0).toUpperCase() + priority.confidence.slice(1)} confidence
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Why it surfaced */}
      <p className="text-xs text-gray-500 leading-relaxed mb-3">{priority.whySurfaced}</p>

      {/* Affected segments */}
      {priority.affectedSegments?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[11px] text-gray-400">Affected:</span>
          {priority.affectedSegments.map((seg) => (
            <span key={seg.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-[11px] text-gray-600">
              {seg.name}
              {seg.share != null && (
                <span className="text-gray-400">({Math.round(seg.share * 100)}%)</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Expand / collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-green-600 hover:text-green-700 font-medium transition-colors"
      >
        {expanded ? "Hide evidence ↑" : "View evidence ↓"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-gray-50 pt-4">
          {/* Why it matters */}
          {priority.whyItMatters && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Why this matters</p>
              <p className="text-xs text-gray-600 leading-relaxed">{priority.whyItMatters}</p>
            </div>
          )}

          {/* Signals */}
          {priority.evidence?.signals?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Evidence</p>
              <ul className="space-y-1">
                {priority.evidence.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">—</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended actions */}
          {priority.recommendedActions?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Recommended next steps</p>
              <ol className="space-y-1">
                {priority.recommendedActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-400 shrink-0 font-medium">{i + 1}.</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Validation questions */}
          {priority.validationQuestions?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Questions to validate</p>
              <ul className="space-y-1">
                {priority.validationQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500 italic">
                    <span className="not-italic shrink-0">–</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
