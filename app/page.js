import Link from "next/link";

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
    <div className="min-h-screen bg-[#0a0a12] text-slate-100">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Distill
        </span>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
            Pricing
          </a>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs mb-8">
          <span>✦</span> No cloud uploads for your data
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
          Turn any CSV into{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            a story
          </span>
          <br />in seconds.
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload a dataset and instantly see every column auto-charted, with AI-written insights
          and shareable dashboards your clients can explore.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-base"
          >
            Upload CSV — free up to 1,000 rows
          </Link>
          <a href="#features" className="text-slate-400 hover:text-white text-sm transition-colors">
            See how it works ↓
          </a>
        </div>
        <p className="text-xs text-slate-600 mt-4">No account required for free tier.</p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-3">
          Everything you need to go from raw data to client-ready report
        </h2>
        <p className="text-slate-500 text-center mb-12">No Excel formulas. No Tableau licenses. No data wrangling.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[#16162a] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-12">Three steps. That&apos;s it.</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { n: "1", title: "Upload your CSV", desc: "Drag and drop any CSV. Distill parses it instantly, right in your browser." },
            { n: "2", title: "Explore instantly", desc: "Every column gets a chart. Filter by any value. See patterns in seconds." },
            { n: "3", title: "Share the story", desc: "Generate an AI narrative and a shareable link. Your client gets a clean, explorable dashboard." },
          ].map((step) => (
            <div key={step.n} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center mb-4">
                {step.n}
              </div>
              <h3 className="font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-3">Simple pricing</h2>
        <p className="text-slate-500 text-center mb-12">Start free. Upgrade when you need more.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`rounded-2xl p-6 border flex flex-col ${
                tier.highlight
                  ? "border-indigo-500/50 bg-indigo-950/40"
                  : "border-white/5 bg-[#16162a]"
              }`}
            >
              {tier.highlight && (
                <div className="text-xs text-indigo-300 font-medium mb-3 uppercase tracking-wider">Most popular</div>
              )}
              <div className="mb-4">
                <div className="text-lg font-bold text-white">{tier.name}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  {tier.price !== "$0" && (
                    <span className="text-slate-500 text-sm">{tier.desc}</span>
                  )}
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`w-full text-center py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  tier.highlight
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "border border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-slate-600 text-sm">
        <span className="font-semibold text-slate-400">Distill</span> — from raw data to insights in seconds.
      </footer>
    </div>
  );
}
