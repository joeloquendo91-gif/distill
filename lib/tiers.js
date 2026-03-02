export const TIERS = {
  free: {
    name: "Free",
    price: 0,
    rowLimit: 1000,
    aiCallsPerMonth: 0,
    sharesAllowed: 0,
    features: [
      "Up to 1,000 rows",
      "All chart types",
      "Column type auto-detection",
      "Basic filters",
    ],
  },
  pro: {
    name: "Pro",
    price: 19,
    rowLimit: 50000,
    aiCallsPerMonth: 50,
    sharesAllowed: 25,
    features: [
      "Up to 50,000 rows",
      "AI-written narrative",
      "25 shareable dashboards",
      "PDF export",
      "Everything in Free",
    ],
  },
  agency: {
    name: "Agency",
    price: 49,
    rowLimit: Infinity,
    aiCallsPerMonth: 200,
    sharesAllowed: Infinity,
    features: [
      "Unlimited rows",
      "Unlimited shares",
      "White-label branding",
      "Client management",
      "Everything in Pro",
    ],
  },
};

export function canUseFeature(tier, feature) {
  const t = TIERS[tier] || TIERS.free;
  switch (feature) {
    case "ai_narrative":
      return t.aiCallsPerMonth > 0;
    case "share":
      return t.sharesAllowed > 0;
    case "unlimited_rows":
      return t.rowLimit === Infinity;
    default:
      return false;
  }
}

export function getRowLimit(tier) {
  return (TIERS[tier] || TIERS.free).rowLimit;
}
