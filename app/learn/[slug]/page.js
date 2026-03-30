import { notFound } from "next/navigation";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import Link from "next/link";
import topics from "@/lib/learnTopics";
import SITE_URL from "@/lib/siteUrl";

// ─── Data helpers ────────────────────────────────────────────────────────────

function getContent(slug) {
  try {
    const path = join(process.cwd(), "content/learn", `${slug}.json`);
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ─── Static generation ───────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const dir = join(process.cwd(), "content/learn");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ slug: f.replace(".json", "") }));
  } catch {
    return [];
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const topic = topics.find((t) => t.slug === slug);
  if (!topic) return {};
  return {
    title: topic.titleTag,
    description: topic.metaDescription,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: {
      title: topic.titleTag,
      description: topic.metaDescription,
      type: "article",
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function LearnArticle({ params }) {
  const { slug } = await params;
  const topic = topics.find((t) => t.slug === slug);
  const content = getContent(slug);

  if (!topic || !content) notFound();

  const relatedTopics = topics.filter((t) =>
    topic.relatedSlugs.includes(t.slug)
  );

  // HowTo JSON-LD — uses the Excel steps as the canonical how-to sequence
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: topic.h1,
    description: topic.metaDescription,
    url: `${SITE_URL}/learn/${topic.slug}`,
    step: content.excelSteps.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `Step ${i + 1}`,
      text,
    })),
  };

  // FAQPage JSON-LD — eligible for FAQ rich results in Google Search
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Nav */}
      <div className="bg-[#1a3a2a]">
        <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold text-white">
            Distill
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/learn"
              className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block"
            >
              All guides
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-2 bg-white text-[#1a3a2a] text-sm font-semibold rounded-full hover:bg-gray-100 transition-colors"
            >
              Try free
            </Link>
          </div>
        </nav>
      </div>

      {/* Article */}
      <article className="max-w-2xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Link href="/learn" className="hover:text-green-600 transition-colors">
            Guides
          </Link>
          <span>/</span>
          <span className="text-green-600 font-medium">{topic.clusterName}</span>
        </div>

        {/* H1 */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-6">
          {topic.h1}
        </h1>

        {/* Intro */}
        <p className="text-lg text-gray-600 leading-relaxed mb-10 pb-10 border-b border-gray-100">
          {content.intro}
        </p>

        {/* What Is */}
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          {content.whatIs.heading}
        </h2>
        <p className="text-gray-600 leading-relaxed mb-10">
          {content.whatIs.body}
        </p>

        {/* When to Use */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {content.whenToUse.heading}
        </h2>
        <ul className="space-y-3 mb-10">
          {content.whenToUse.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-600">
              <span className="text-green-500 mt-0.5 shrink-0 font-bold">✓</span>
              {bullet}
            </li>
          ))}
        </ul>

        {/* Excel Steps */}
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {content.excelSteps.heading}
        </h2>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-5">
          {content.excelSteps.subheading}
        </p>
        <ol className="space-y-4 mb-10">
          {content.excelSteps.steps.map((step, i) => (
            <li key={i} className="flex gap-4 text-gray-600">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        {/* Google Sheets Steps */}
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {content.sheetsSteps.heading}
        </h2>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-5">
          {content.sheetsSteps.subheading}
        </p>
        <ol className="space-y-4 mb-10">
          {content.sheetsSteps.steps.map((step, i) => (
            <li key={i} className="flex gap-4 text-gray-600">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        {/* Distill CTA card */}
        <div className="bg-[#f0fdf4] rounded-2xl p-8 mb-10 border border-green-100">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {content.distillSection.heading}
          </h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            {content.distillSection.body}
          </p>

          {/* GIF — swap src to /distill-demo.gif once recorded */}
          <div
            className="rounded-xl overflow-hidden bg-gray-100 w-full aspect-video flex items-center justify-center mb-6 border border-gray-200"
            role="img"
            aria-label={content.gifAlt}
          >
            <p className="text-gray-400 text-sm text-center px-4">
              Demo coming soon. Upload your CSV to try it live.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-block px-8 py-3.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-colors text-base"
          >
            Upload your CSV. It&apos;s free.
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            Free up to 1,000 rows. No account required.
          </p>
        </div>

        {/* FAQs */}
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Frequently Asked Questions
        </h2>
        <div className="space-y-7 mb-14">
          {content.faqs.map((faq, i) => (
            <div key={i}>
              <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
              <p className="text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        {/* Related guides */}
        {relatedTopics.length > 0 && (
          <div className="border-t border-gray-100 pt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              Related guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedTopics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/learn/${t.slug}`}
                  className="p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 leading-snug block">
                    {t.h1}
                  </span>
                  <span className="text-xs text-green-500 mt-1.5 block font-medium">
                    Read →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="bg-[#1a3a2a] py-8 text-center text-white/50 text-sm">
        <span className="font-semibold text-white/80">Distill</span> — from raw
        data to insights in seconds.
      </footer>
    </div>
  );
}
