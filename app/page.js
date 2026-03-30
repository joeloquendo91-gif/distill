import Link from "next/link";
import SITE_URL from "@/lib/siteUrl";

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Distill",
  description:
    "Upload a CSV and instantly get auto-charts, AI-written narrative, and shareable dashboards. No setup, no formulas.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "19", priceCurrency: "USD" },
    { "@type": "Offer", name: "Agency", price: "49", priceCurrency: "USD" },
  ],
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Distill",
  url: SITE_URL,
  description: "Turn any CSV into insights in seconds.",
};

const CARD_COLORS = ["bg-[#f0fdf4]", "bg-[#f5f3ff]", "bg-[#eff6ff]"];

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant explore-ready dashboard",
    desc: "Every column auto-charted the moment you upload. Categorical, numeric, date, Likert, multi-select — Distill detects and visualizes each one.",
  },
  {
    icon: "✦",
    title: "AI-written narrative",
    desc: "Claude reads your data and writes the executive summary. Patterns, anomalies, and recommendations — ready to paste into your client report.",
  },
  {
    icon: "↑",
    title: "Shareable in one click",
    desc: "Generate a clean, read-only link your client can explore. No account needed on their end. Your data never hits our servers.",
  },
  {
    icon: "🔍",
    title: "Cross-column filters",
    desc: "Filter by any categorical column and every other chart updates instantly. Slice your data without writing a single formula.",
  },
  {
    icon: "🔒",
    title: "Your data stays local",
    desc: "All CSV processing happens in your browser. We only store the aggregated summaries needed for sharing — never your raw data.",
  },
  {
    icon: "📐",
    title: "Built for agencies",
    desc: "Manage multiple client datasets, generate branded reports, and share polished dashboards without the overhead of a BI tool.",
  },
];

const TIERS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    desc: "Try it out",
    features: ["Up to 1,000 rows", "All chart types", "Auto column detection", "Basic filters"],
    cta: "Start for free",
    href: "/dashboard",
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    desc: "per month",
    features: ["Up to 50,000 rows", "AI-written narrative", "25 shareable dashboards", "PDF export", "Everything in Free"],
    cta: "Start Pro",
    href: "/dashboard",
    highlight: true,
  },
  {
    key: "agency",
    name: "Agency",
    price: "$49",
    desc: "per month",
    features: ["Unlimited rows", "Unlimited shares", "White-label branding", "Client management", "Everything in Pro"],
    cta: "Start Agency",
    href: "/dashboard",
    highlight: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />

      {/* Nav + Hero — dark forest green */}
      <div className="bg-[#1a3a2a]">
        <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <span className="text-xl font-bold text-white">Distill</span>
          <div className="flex items-center gap-6">
            <Link href="/learn" className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block">
              Guides
            </Link>
            <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block">
              Pricing
            </a>
            <Link
              href="/dashboard"
              className="px-5 py-2 bg-white text-[#1a3a2a] text-sm font-semibold rounded-full hover:bg-gray-100 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </nav>

        <section className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs mb-8">
            <span>✦</span> No cloud uploads for your data
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
            Turn any CSV into{" "}
            <span className="text-green-400">a story</span>
            <br />in seconds.
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload a dataset and instantly see every column auto-charted, with AI-written insights
            and shareable dashboards your clients can explore.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 bg-white text-[#1a3a2a] font-semibold rounded-full hover:bg-gray-100 transition-colors text-base"
            >
              Upload CSV — free up to 1,000 rows
            </Link>
            <a href="#features" className="text-white/60 hover:text-white text-sm transition-colors">
              See how it works ↓
            </a>
          </div>
          <p className="text-xs text-white/30 mt-4">No account required for free tier.</p>
        </section>
      </div>

      {/* Features — white bg, alternating cards */}
      <section id="features" className="bg-white max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Everything you need to go from raw data to client-ready report
        </h2>
        <p className="text-gray-500 text-center mb-12">No Excel formulas. No Tableau licenses. No data wrangling.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`${CARD_COLORS[i % 3]} rounded-2xl p-6 border border-gray-100 hover:shadow-sm transition-shadow`}
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — bg-slate-50 */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-12">Three steps. That&apos;s it.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: "1", title: "Upload your CSV", desc: "Drag and drop any CSV. Distill parses it instantly, right in your browser." },
              { n: "2", title: "Explore instantly", desc: "Every column gets a chart. Filter by any value. See patterns in seconds." },
              { n: "3", title: "Share the story", desc: "Generate an AI narrative and a shareable link. Your client gets a clean, explorable dashboard." },
            ].map((step) => (
              <div key={step.n} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white font-bold flex items-center justify-center mb-4 text-sm">
                  {step.n}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — white bg */}
      <section id="pricing" className="bg-white max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Simple pricing</h2>
        <p className="text-gray-500 text-center mb-12">Start free. Upgrade when you need more.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`rounded-2xl p-6 border flex flex-col ${
                tier.highlight
                  ? "border-green-400 bg-[#f0fdf4]"
                  : "border-gray-200 bg-white"
              }`}
            >
              {tier.highlight && (
                <div className="text-xs text-green-600 font-medium mb-3 uppercase tracking-wider">Most popular</div>
              )}
              <div className="mb-4">
                <div className="text-lg font-bold text-gray-900">{tier.name}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-gray-900">{tier.price}</span>
                  {tier.price !== "$0" && (
                    <span className="text-gray-400 text-sm">{tier.desc}</span>
                  )}
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`w-full text-center py-2.5 rounded-full font-medium text-sm transition-colors ${
                  tier.highlight
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer — dark forest green */}
      <footer className="bg-[#1a3a2a] py-8 text-center text-white/50 text-sm">
        <span className="font-semibold text-white/80">Distill</span> — from raw data to insights in seconds.
      </footer>
    </div>
  );
}
