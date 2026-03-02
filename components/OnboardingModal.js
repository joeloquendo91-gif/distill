"use client";
import { useState } from "react";

const DATA_TYPES = [
  { value: "sales",   label: "Sales / CRM",           icon: "📈" },
  { value: "product", label: "Product / Analytics",   icon: "⚡" },
  { value: "hr",      label: "HR / People",            icon: "👥" },
  { value: "finance", label: "Finance / Ops",          icon: "💰" },
  { value: "survey",  label: "Survey / Feedback",      icon: "📋" },
  { value: "other",   label: "Other",                  icon: "📊" },
];

const AUDIENCES = [
  { value: "self",       label: "Just me" },
  { value: "team",       label: "My team" },
  { value: "client",     label: "A client" },
  { value: "leadership", label: "Leadership / Exec" },
];

export default function OnboardingModal({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [context, setContext] = useState({ dataType: "", goal: "", audience: "" });

  function handleDataType(value) {
    setContext((c) => ({ ...c, dataType: value }));
    setStep(1);
  }

  function handleAudience(value) {
    onComplete({ ...context, audience: value });
  }

  const stepLabels = ["Data type", "Your goal", "Audience"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        {/* Skip */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600"
        >
          Skip
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < step ? "bg-green-500" : i === step ? "bg-green-400" : "bg-gray-200"
                }`}
              />
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
          <span className="text-[10px] text-gray-400 ml-2">
            {step + 1} of {stepLabels.length}
          </span>
        </div>

        {/* Step 0: Data type */}
        {step === 0 && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              What type of data is this?
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Helps Distill surface the most relevant insights first.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DATA_TYPES.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => handleDataType(value)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 text-left hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 1: Goal */}
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              What decision are you trying to make?
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Optional — helps the AI narrative focus on what matters.
            </p>
            <textarea
              autoFocus
              rows={3}
              placeholder="e.g. Identify which customers are at risk of churning this quarter"
              value={context.goal}
              onChange={(e) => setContext((c) => ({ ...c, goal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-green-400 text-gray-800 placeholder-gray-300"
            />
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => setStep(0)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs font-medium transition-colors"
              >
                {context.goal.trim() ? "Next →" : "Skip →"}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Who will read this?
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Distill tailors the insight language to your audience.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleAudience(value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
