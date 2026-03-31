// Deterministic signal extraction — no LLM required.
// Reads rows + dataProfile (from recon) and returns a brief-ready structure
// matching the PriorityCard schema. Sprint 3 will replace text generation
// with a Claude Haiku synthesis layer.

function fmt(n) {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return n.toLocaleString();
}

function pct(n) {
  return Math.round(n * 100) + "%";
}

function sumBy(rows, metric, dim) {
  const totals = {};
  for (const row of rows) {
    const key = String(row[dim] ?? "").trim();
    if (!key || key.toLowerCase() === "n/a" || key === "-") continue;
    const val = parseFloat(row[metric]);
    if (!isNaN(val)) {
      totals[key] = (totals[key] || 0) + val;
    }
  }
  return totals;
}

// Returns the single strongest concentration signal for a given dimension column.
// Returns null if no meaningful concentration exists (top < 50%).
function concentrationSignal(rows, metric, dim, dimLabel) {
  const totals = sumBy(rows, metric, dim);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2) return null;

  const grandTotal = entries.reduce((s, [, v]) => s + v, 0);
  if (grandTotal === 0) return null;

  const [topName, topVal] = entries[0];
  const topShare = topVal / grandTotal;

  if (topShare < 0.5) return null;

  const priority = topShare >= 0.7 ? "high" : "medium";
  const others = entries.slice(1, 4);

  const otherTotal = grandTotal - topVal;
  const otherLine =
    others.length > 0
      ? others.map(([n, v]) => `${n}: ${fmt(v)} (${pct(v / grandTotal)})`).join(" — ")
      : null;

  return {
    id: `concentration_${dim}`,
    title: `${topName} accounts for ${pct(topShare)} of ${metric}`,
    priority,
    confidence: "high",
    whySurfaced: `${topName} generates ${fmt(topVal)} — ${pct(topShare)} of total ${metric}. ${
      otherLine
        ? `Other ${dimLabel}s combined generate ${fmt(otherTotal)}: ${otherLine}.`
        : `All other ${dimLabel}s combined generate just ${fmt(otherTotal)}.`
    }`,
    whyItMatters: `A single ${dimLabel} generating ${pct(topShare)} of ${metric} creates high concentration risk. Any disruption to ${topName} has almost no fallback.`,
    affectedSegments: [
      { name: topName, share: topShare },
      ...others.slice(0, 2).map(([n, v]) => ({ name: n, share: v / grandTotal })),
    ],
    evidence: {
      signals: [
        `${topName}: ${fmt(topVal)} (${pct(topShare)} of total ${metric})`,
        ...others.map(([n, v]) => `${n}: ${fmt(v)} (${pct(v / grandTotal)})`),
        `Concentration is ${entries.length}-way — top value alone exceeds ${pct(topShare)}`,
      ],
      examples: [],
    },
    recommendedActions: [
      `Investigate why ${topName} drives ${pct(topShare)} of ${metric} while other ${dimLabel}s lag`,
      `Model the ${metric} impact of a 20% reduction in ${topName}`,
      `Identify which other ${dimLabel}s have the strongest growth potential`,
    ],
    validationQuestions: [
      `Is the concentration in ${topName} a deliberate strategy or an unmanaged default?`,
      `Are other ${dimLabel}s resourced and prioritised for growth?`,
    ],
    _score: topShare,
  };
}

// Returns a trend signal if the most recent year shows a meaningful decline.
function trendSignal(rows, metric, yearCol) {
  const totals = sumBy(rows, metric, yearCol);
  const sorted = Object.entries(totals)
    .map(([y, v]) => [String(y).trim(), v])
    .filter(([y]) => /^\d{4}$/.test(y))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (sorted.length < 2) return null;

  const [prevYear, prevVal] = sorted[sorted.length - 2];
  const [lastYear, lastVal] = sorted[sorted.length - 1];

  if (prevVal === 0) return null;
  const change = (lastVal - prevVal) / prevVal;
  const absPct = Math.abs(Math.round(change * 100));

  // Only surface declines; ignore <3% swings as noise
  if (change >= -0.03) return null;

  const priority = absPct >= 10 ? "high" : absPct >= 5 ? "medium" : "watch";

  const evidenceLines = sorted.map(([y, v], i) => {
    if (i === 0) return `${y}: ${fmt(v)}`;
    const prev = sorted[i - 1][1];
    const chg = Math.round(((v - prev) / prev) * 100);
    return `${y}: ${fmt(v)} (${chg >= 0 ? "+" : ""}${chg}% vs ${sorted[i - 1][0]})`;
  });

  return {
    id: `trend_${yearCol}`,
    title: `${metric} fell ${absPct}% in ${lastYear} after ${prevYear}`,
    priority,
    confidence: "high",
    whySurfaced: `${lastYear} ${metric} of ${fmt(lastVal)} is a ${absPct}% decline versus ${prevYear} (${fmt(prevVal)}), reversing the prior year's trajectory.`,
    whyItMatters: `A ${metric} decline after prior performance is an early warning. Understanding whether this is isolated or structural determines the right response.`,
    affectedSegments: [{ name: lastYear, share: null }],
    evidence: {
      signals: evidenceLines,
      examples: [],
    },
    recommendedActions: [
      `Segment the ${lastYear} ${metric} decline by key dimensions to isolate the source`,
      `Compare average transaction values in ${prevYear} vs ${lastYear}`,
      `Identify which entities drove the most ${metric} loss between ${prevYear} and ${lastYear}`,
    ],
    validationQuestions: [
      `Is the ${lastYear} decline concentrated in one segment or broad across the business?`,
      `Are there open or pending transactions in ${lastYear} that could change the picture?`,
    ],
    _score: absPct / 100,
  };
}

// Returns a disparity signal if one entity dramatically outperforms others in a dimension.
// Fires on "who" dimensions only — rep/client/product type rankings.
function disparitySignal(rows, metric, dim, dimLabel) {
  const totals = sumBy(rows, metric, dim);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length < 3) return null;

  const grandTotal = entries.reduce((s, [, v]) => s + v, 0);
  if (grandTotal === 0) return null;

  const avg = grandTotal / entries.length;
  const [topName, topVal] = entries[0];
  const ratio = topVal / avg;

  // Only surface if top entity is at least 3x the average
  if (ratio < 3) return null;

  const bottom3 = entries.slice(-3);
  const top3 = entries.slice(0, Math.min(3, entries.length));

  return {
    id: `disparity_${dim}`,
    title: `${topName} generates ${Math.round(ratio)}x the average ${dimLabel} ${metric}`,
    priority: "medium",
    confidence: "medium",
    whySurfaced: `${topName} produces ${fmt(topVal)} (${pct(topVal / grandTotal)} of total). The average ${dimLabel} generates ${fmt(avg)}. Top and bottom ${dimLabel}s are operating at very different levels.`,
    whyItMatters: `A ${Math.round(ratio)}x performance gap between ${dimLabel}s suggests either a key-person dependency or an opportunity to replicate what ${topName} is doing differently.`,
    affectedSegments: top3.map(([n, v]) => ({ name: n, share: v / grandTotal })),
    evidence: {
      signals: [
        `Top ${dimLabel}: ${topName} — ${fmt(topVal)} (${pct(topVal / grandTotal)})`,
        `Average ${dimLabel}: ${fmt(avg)}`,
        ...bottom3.map(([n, v]) => `Bottom performer: ${n} — ${fmt(v)} (${pct(v / grandTotal)})`),
      ],
      examples: [],
    },
    recommendedActions: [
      `Identify what ${topName} does differently — deal size, segment focus, conversion rate`,
      `Review whether bottom-performing ${dimLabel}s have the right accounts or support`,
      `Model what happens if ${topName} leaves or reduces activity`,
    ],
    validationQuestions: [
      `Is ${topName}'s outperformance driven by account quality, tenure, or skill?`,
      `Are lower-performing ${dimLabel}s new, under-resourced, or in weaker territories?`,
    ],
    _score: ratio / 10,
  };
}

// Main export — call with full rows array and the dataProfile from recon.
// Returns null if insufficient data to produce a brief.
export function extractSignals(rows, dataProfile) {
  if (!rows?.length || !dataProfile) return null;

  const { primaryMetric, dimensions } = dataProfile;
  if (!primaryMetric) return null;

  const candidates = [];

  // Concentration signals — strongest signal per dimension group
  const groups = [
    { cols: dimensions?.who ?? [], label: "entity" },
    { cols: dimensions?.where ?? [], label: "region" },
    { cols: dimensions?.what ?? [], label: "category" },
  ];

  for (const { cols, label } of groups) {
    const groupSignals = [];
    for (const col of cols) {
      const sig = concentrationSignal(rows, primaryMetric, col, label);
      if (sig) groupSignals.push(sig);
    }
    // Take the highest-share signal per group to avoid duplicates
    if (groupSignals.length > 0) {
      groupSignals.sort((a, b) => b._score - a._score);
      candidates.push(groupSignals[0]);
    }
  }

  // Trend signal — use first Year column found
  const yearCols = (dimensions?.when ?? []).filter((c) => /year/i.test(c));
  if (yearCols.length > 0) {
    const sig = trendSignal(rows, primaryMetric, yearCols[0]);
    if (sig) candidates.push(sig);
  }

  // Disparity signal — "who" dimension only (reps, clients, products)
  const whoCols = dimensions?.who ?? [];
  for (const col of whoCols) {
    const sig = disparitySignal(rows, primaryMetric, col, "entity");
    if (sig) { candidates.push(sig); break; } // one disparity signal is enough
  }

  if (candidates.length === 0) return null;

  // Sort: high priority first, then by internal score
  const ORDER = { high: 0, medium: 1, watch: 2 };
  candidates.sort((a, b) => {
    const po = (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3);
    if (po !== 0) return po;
    return (b._score ?? 0) - (a._score ?? 0);
  });

  const priorities = candidates.slice(0, 5).map(({ _score, ...p }) => p);

  // Summary sentence
  const highCount = priorities.filter((p) => p.priority === "high").length;
  const parts = priorities
    .slice(0, 3)
    .map((p) => p.title.charAt(0).toLowerCase() + p.title.slice(1));
  const summary = `This dataset shows ${priorities.length} investigation priorit${priorities.length !== 1 ? "ies" : "y"}: ${parts.join("; ")}.`;

  return { summary, priorities };
}
