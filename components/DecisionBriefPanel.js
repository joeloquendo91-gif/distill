"use client";
import PriorityCard from "./PriorityCard";

// Mocked priorities shown until Sprint 3 wires real data.
// These are illustrative — they show what the brief looks like with a real dataset.
const MOCK_BRIEF = {
  summary:
    "This dataset shows 3 investigation priorities. Direct Sales generates 94% of revenue with no meaningful fallback channel, revenue declined 9.3% in 2024 after a strong 2023, and North America accounts for 94% of geographic exposure.",
  priorities: [
    {
      id: "mock_1",
      title: "Direct Sales generates 94% of revenue with no fallback",
      priority: "high",
      confidence: "high",
      whySurfaced:
        "Direct Sales accounts for $3.4M — 94% of total revenue. Partner, Online, and In-Store combined generate just $222K. Any disruption to Direct Sales has almost no buffer.",
      whyItMatters:
        "A single channel generating 94% of revenue means the business has effectively one route to market. At this level of dependency, diversification is not optional.",
      affectedSegments: [{ name: "Direct Sales", share: 0.94 }],
      evidence: {
        signals: [
          "Direct Sales: $3.4M (94% of total revenue)",
          "Partner: $120K (3%) — Online: $61K (2%) — In-Store: $41K (1%)",
          "Concentration is consistent across all 3 years in the dataset — not improving",
        ],
        examples: [],
      },
      recommendedActions: [
        "Audit why Partner and Online channels generate under 5% of revenue despite being active",
        "Identify Enterprise accounts that could be transitioned to a Partner or self-serve motion",
        "Model the revenue impact of shifting 10 percentage points from Direct to Partner",
      ],
      validationQuestions: [
        "Is Direct Sales concentration a deliberate strategy or an unmanaged default?",
        "Are Partner and Online channels resourced to grow, or effectively frozen?",
      ],
    },
    {
      id: "mock_2",
      title: "Revenue fell 9.3% in 2024 after strong 2023 growth",
      priority: "high",
      confidence: "high",
      whySurfaced:
        "2024 revenue declined 9.3% versus 2023, reversing a year of strong growth. Several Q4 2024 orders are still in Processing status, which may be masking further decline.",
      whyItMatters:
        "A reversal after growth is an early warning. If the Processing orders represent delayed deals rather than pipeline, the real 2024 decline could be steeper than the headline number.",
      affectedSegments: [{ name: "2024", share: null }],
      evidence: {
        signals: [
          "2022 → 2023: strong revenue growth",
          "2023 → 2024: -9.3% decline",
          "5 orders in Processing status in Q4 2024 — outcome not yet confirmed",
        ],
        examples: [],
      },
      recommendedActions: [
        "Segment the 2024 decline by sales rep, channel, and customer segment to isolate the source",
        "Resolve the 5 Q4 2024 Processing orders — determine if they are delayed revenue or lost deals",
        "Compare average order values across 2022, 2023, and 2024 — shrinking deal size signals a different problem",
      ],
      validationQuestions: [
        "Is the 2024 decline concentrated in one rep or one segment, or is it broad?",
        "Did any key Enterprise accounts reduce spend or stop ordering between 2023 and 2024?",
      ],
    },
    {
      id: "mock_3",
      title: "North America carries 94% of geographic revenue exposure",
      priority: "medium",
      confidence: "high",
      whySurfaced:
        "North America generates $3.4M (94%) of revenue. Europe contributes $190K (5%). APAC and LATAM together are under 2%.",
      whyItMatters:
        "Geographic concentration mirrors channel concentration — the business is exposed to a single market through a single channel. A North American disruption has almost no regional fallback.",
      affectedSegments: [{ name: "North America", share: 0.94 }, { name: "Europe", share: 0.05 }],
      evidence: {
        signals: [
          "North America: $3.4M (94% of total revenue)",
          "Europe: $190K (5%) — APAC: $28K (1%) — LATAM: $3K (<1%)",
          "Geographic concentration is stable across all years — no improvement trend",
        ],
        examples: [],
      },
      recommendedActions: [
        "Map which product categories and customer segments have the highest European presence",
        "Assess whether the sales team has active quota coverage for European accounts",
        "Identify the top 5 European accounts by revenue and evaluate expansion potential",
      ],
      validationQuestions: [
        "Is geographic expansion on the roadmap, or is the North America focus intentional?",
        "Are European accounts being worked by a dedicated team or handled opportunistically?",
      ],
    },
  ],
};

export default function DecisionBriefPanel({ brief, dataProfile, dataContext }) {
  // brief is populated by extractSignals() when recon + data are ready.
  // Falls back to MOCK_BRIEF when no file is uploaded or recon is still running.
  const data = brief || MOCK_BRIEF;
  const isMock = !brief;

  const highCount = data.priorities.filter((p) => p.priority === "high").length;
  const mediumCount = data.priorities.filter((p) => p.priority === "medium").length;
  const watchCount = data.priorities.filter((p) => p.priority === "watch").length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left column — priorities */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {highCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-xs font-medium text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {highCount} High priorit{highCount > 1 ? "ies" : "y"}
            </span>
          )}
          {mediumCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-medium text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {mediumCount} Medium priorit{mediumCount > 1 ? "ies" : "y"}
            </span>
          )}
          {watchCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs font-medium text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {watchCount} Watch item{watchCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Priority cards */}
        {data.priorities.map((p, i) => (
          <PriorityCard key={p.id} priority={p} index={i} />
        ))}

        {/* Mock disclaimer */}
        {isMock && (
          <p className="text-[11px] text-gray-400 text-center pt-2">
            Example priorities — real analysis runs automatically after upload.
          </p>
        )}
      </div>

      {/* Right column — brief summary + data context */}
      <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
        {/* Brief summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Brief summary</p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
        </div>

        {/* Data context — populated from reconData.dataProfile */}
        {(dataProfile || dataContext) && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Data context</p>

            {dataContext && (
              <p className="text-xs text-gray-600 leading-relaxed">{dataContext}</p>
            )}

            {dataProfile?.grain && (
              <div>
                <span className="text-[11px] text-green-500 font-medium">Each row: </span>
                <span className="text-[11px] text-gray-600">{dataProfile.grain}</span>
              </div>
            )}
            {dataProfile?.primaryMetric && (
              <div>
                <span className="text-[11px] text-green-500 font-medium">Primary metric: </span>
                <span className="text-[11px] text-gray-600">{dataProfile.primaryMetric}</span>
              </div>
            )}
            {dataProfile?.dimensions && (() => {
              const d = dataProfile.dimensions;
              const all = [...(d.who ?? []), ...(d.where ?? []), ...(d.when ?? []), ...(d.what ?? [])].filter(Boolean);
              return all.length > 0 ? (
                <div>
                  <span className="text-[11px] text-green-500 font-medium">Dimensions: </span>
                  <span className="text-[11px] text-gray-600">{all.join(", ")}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* What to do next */}
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-2">How to use this brief</p>
          <ul className="space-y-1.5">
            {[
              "Review each priority in order",
              "Expand evidence to validate the finding",
              "Use recommended steps as your investigation starting point",
              "Switch to Dashboard to explore charts",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-[11px] text-green-700">
                <span className="shrink-0 mt-0.5">→</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
