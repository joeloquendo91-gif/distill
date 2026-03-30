"use client";
import { TIERS } from "@/lib/tiers";

export default function TierGateModal({ feature, currentTier, onClose, onSignIn }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <div className="text-3xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Unlock {feature}</h2>
        <p className="text-gray-500 text-sm mb-6">
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
                    ? "border-green-400 bg-[#f0fdf4]"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{t.name}</span>
                  <span className="text-green-600 font-bold">${t.price}/mo</span>
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
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
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 text-sm transition-colors"
          >
            Maybe later
          </button>
          <button
            onClick={onSignIn || (() => alert("Stripe integration coming soon! Email us to upgrade."))}
            className="flex-1 px-4 py-2.5 rounded-full bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition-colors"
          >
            {onSignIn ? "Sign in to upgrade" : "Upgrade now"}
          </button>
        </div>
      </div>
    </div>
  );
}
