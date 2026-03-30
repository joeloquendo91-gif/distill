import Link from "next/link";
import { readdirSync } from "fs";
import { join } from "path";
import topics from "@/lib/learnTopics";
import SITE_URL from "@/lib/siteUrl";

export const metadata = {
  title: "Data Visualization Guides: Charts and Dashboard Tutorials | Distill",
  description:
    "Learn how to make bar charts, line charts, pie charts, and dashboards in Excel, Google Sheets, or instantly with Distill. Free tutorials for every chart type.",
};

function getPublishedSlugs() {
  try {
    const dir = join(process.cwd(), "content/learn");
    return new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
    );
  } catch {
    return new Set();
  }
}

const CLUSTERS = [
  { id: 1, name: "Chart Types" },
  { id: 2, name: "Business Use Cases" },
  { id: 3, name: "CSV to Charts" },
];

export default function LearnIndex() {
  const published = getPublishedSlugs();

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Data Visualization Guides",
    description:
      "Free tutorials for making charts and dashboards in Excel, Google Sheets, and Distill.",
    url: `${SITE_URL}/learn`,
    itemListElement: topics
      .filter((t) => published.has(t.slug))
      .map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/learn/${t.slug}`,
        name: t.h1,
      })),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      {/* Nav + Hero */}
      <div className="bg-[#1a3a2a]">
        <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold text-white">
            Distill
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2 bg-white text-[#1a3a2a] text-sm font-semibold rounded-full hover:bg-gray-100 transition-colors"
          >
            Try free
          </Link>
        </nav>

        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs mb-6">
            <span>✦</span> Free tutorials
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            Data Visualization Guides
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Learn how to make any chart in Excel or Google Sheets, or skip
            straight to Distill and get it done in seconds from your CSV.
          </p>
        </div>
      </div>

      {/* Article clusters */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-14">
        {CLUSTERS.map((cluster) => {
          const clusterTopics = topics.filter((t) => t.cluster === cluster.id);
          return (
            <section key={cluster.id} aria-labelledby={`cluster-${cluster.id}`}>
              <h2
                id={`cluster-${cluster.id}`}
                className="text-xl font-bold text-gray-900 mb-1"
              >
                {cluster.name}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                {clusterTopics.filter((t) => published.has(t.slug)).length} of{" "}
                {clusterTopics.length} guides published
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clusterTopics.map((t) =>
                  published.has(t.slug) ? (
                    <Link
                      key={t.slug}
                      href={`/learn/${t.slug}`}
                      className="p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 leading-snug block">
                        {t.h1}
                      </span>
                      <span className="text-xs text-green-500 mt-1.5 block font-medium">
                        Read guide →
                      </span>
                    </Link>
                  ) : (
                    <div
                      key={t.slug}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-400 leading-snug block">
                        {t.h1}
                      </span>
                      <span className="text-xs text-gray-300 mt-1.5 block">
                        Coming soon
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* CTA banner */}
      <div className="bg-[#f0fdf4] border-y border-green-100 py-14">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ready to skip the tutorial?
          </h2>
          <p className="text-gray-500 mb-6">
            Upload any CSV to Distill and every column is auto-charted
            instantly. No Excel, no formulas, no setup.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-3.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-colors"
          >
            Upload your CSV free
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            Free up to 1,000 rows. No account required.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1a3a2a] py-8 text-center text-white/50 text-sm">
        <span className="font-semibold text-white/80">Distill</span> — from raw
        data to insights in seconds.
      </footer>
    </div>
  );
}
