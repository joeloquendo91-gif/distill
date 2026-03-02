"use client";
import { TIERS } from "@/lib/tiers";

export default function TierGateModal({ feature, currentTier, onClose, onSignIn }) {
  const isLoggedOut = currentTier === "free" && !onSignIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-3xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Unlock {feature}</h2>
        <p className="text-slate-400 text-sm mb-6">
          {feature} is available on Pro and Agency plans. Upgrade to keep going.
        </p>

        <div className="space-y-3 mb-6">
          {["pro", "agency"].map((tierKey) => {
            const t = TIERS[tierKey];
            return (
              <div
                key={tierKey}
                className={`rounded-xl border p-4 ${
                  tierKey === "pro"
                    ? "border-indigo-500/40 bg-indigo-500/10"
                    : "border-white/10 bg-white/3"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span className="text-indigo-300 font-bold">${t.price}/mo</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-0.5">
                  {t.features.slice(0, 3).map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Maybe later
          </button>
          <button
            onClick={onSignIn || (() => alert("Stripe integration coming soon! Email us to upgrade."))}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            {onSignIn ? "Sign in to upgrade" : "Upgrade now"}
          </button>
        </div>
      </div>
    </div>
  );
}
