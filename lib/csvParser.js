export const COL_TYPES = {
  CATEGORICAL: "categorical",
  NUMERIC: "numeric",
  DATE: "date",
  LIKERT_NUM: "likert_num",
  LIKERT_TEXT: "likert_text",
  TEXT: "text",
  MULTI_SELECT: "multi_select",
};

const LIKERT_SCALE_WORDS = [
  "strongly agree", "agree", "somewhat agree", "neither agree nor disagree",
  "neutral", "disagree", "somewhat disagree", "strongly disagree",
  "very satisfied", "satisfied", "somewhat satisfied",
  "neither satisfied nor dissatisfied",
  "somewhat dissatisfied", "dissatisfied", "very dissatisfied",
  "excellent", "very good", "good", "fair", "poor", "very poor",
  "always", "very often", "often", "sometimes", "rarely", "never",
  "very likely", "likely", "somewhat likely", "unlikely", "very unlikely",
  "extremely important", "very important", "important",
  "somewhat important", "not important",
];

const STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","is","it","its","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","can",
  "this","that","these","those","i","you","he","she","we","they","me","him",
  "her","us","them","my","your","his","our","their","not","no","so","if",
  "as","from","about","than","then","when","where","who","what","which","how",
  "very","more","most","also","just","like","get","got","n/a","na","none",
  "yes","no","ok","okay","well","really","even","much","many","some","any",
]);

const EMPTY_VALUES = new Set(["", "n/a", "na", "null", "nil", "-", "—", "none"]);

function isEmpty(v) {
  return v === null || v === undefined || EMPTY_VALUES.has(String(v).trim().toLowerCase());
}

export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    import("papaparse").then(({ default: Papa }) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error("Failed to parse CSV: " + results.errors[0].message));
            return;
          }
          resolve({
            headers: results.meta.fields || [],
            rows: results.data,
            rowCount: results.data.length,
          });
        },
        error: (err) => reject(new Error("CSV parse error: " + err.message)),
      });
    });
  });
}

// Parses a date string, including non-standard formats like "15-Jul-2019".
function tryParseDate(v) {
  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // DD-MMM-YYYY / D-Mon-YYYY (e.g. "15-Jul-2019", "1-Jan-2020")
  const m = s.match(/^(\d{1,2})[\-\/]([A-Za-z]{3,9})[\-\/](\d{4})$/);
  if (m) {
    const p = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
    if (!isNaN(p.getTime())) return p;
  }
  return null;
}

export function detectColumnType(values) {
  const nonEmpty = values.filter((v) => !isEmpty(v));
  if (nonEmpty.length === 0) return COL_TYPES.TEXT;

  const sample = nonEmpty.slice(0, 300).map((v) => String(v).trim());
  const uniqueSet = new Set(sample.map((v) => v.toLowerCase()));

  // Multi-select: semicolon-separated
  const semiCount = sample.filter((v) => v.includes(";")).length;
  if (semiCount > sample.length * 0.3) return COL_TYPES.MULTI_SELECT;

  // Multi-select: comma-separated with 2–12 short items
  const commaMultiCount = sample.filter((v) => {
    const parts = v.split(",");
    return (
      parts.length >= 2 &&
      parts.length <= 12 &&
      parts.every((p) => p.trim().length > 0 && p.trim().length < 60)
    );
  }).length;
  if (commaMultiCount > sample.length * 0.4) {
    // Only treat as multi-select if the individual items form a finite vocabulary.
    // Many unique parts → likely addresses, names, or natural text with commas.
    const vocab = new Set();
    sample.forEach((v) => {
      if (v.includes(",")) v.split(",").forEach((p) => { const t = p.trim(); if (t) vocab.add(t.toLowerCase()); });
    });
    if (vocab.size <= 30) return COL_TYPES.MULTI_SELECT;
  }

  // Likert text — exact match only to avoid false positives ("good morning", "fair enough", etc.)
  const likertTextCount = sample.filter((v) =>
    LIKERT_SCALE_WORDS.some((w) => w === v.toLowerCase())
  ).length;
  if (likertTextCount > sample.length * 0.5 && uniqueSet.size <= 10) {
    return COL_TYPES.LIKERT_TEXT;
  }

  // Date — must run before numeric so "15-Jul-2019" isn't swallowed as a partial number
  const dateCount = sample.filter((v) => {
    const d = tryParseDate(v);
    return d !== null && /\d{4}|\d{1,2}[\/\-][\dA-Za-z]/.test(v);
  }).length;
  if (dateCount > sample.length * 0.75) return COL_TYPES.DATE;

  // Numeric — strip currency symbols and percent signs before parsing
  const numericCount = sample.filter((v) => {
    const s = v.replace(/[$€£¥₹₩,%]/g, "").replace(/,/g, "").trim();
    return s.length > 0 && !isNaN(parseFloat(s)) && isFinite(Number(s));
  }).length;
  if (numericCount > sample.length * 0.85) {
    const nums = sample
      .map((v) => parseFloat(v.replace(/[$€£¥₹₩,%]/g, "").replace(/,/g, "").trim()))
      .filter((n) => !isNaN(n));
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const uniqueNums = new Set(nums.map(Math.round));
    const allIntegers = nums.every((n) => Math.abs(n - Math.round(n)) < 0.001);
    if (min >= 1 && max <= 10 && allIntegers && uniqueNums.size <= 10 && max - min <= 9) {
      return COL_TYPES.LIKERT_NUM;
    }
    // Year dimension: small set of integers in calendar year range → categorical
    if (allIntegers && uniqueNums.size <= 20 && min >= 1900 && max <= 2100) {
      return COL_TYPES.CATEGORICAL;
    }
    return COL_TYPES.NUMERIC;
  }

  // Long text (free response) or high-cardinality identifiers (IDs, emails, names)
  const avgLen = sample.reduce((s, v) => s + v.length, 0) / sample.length;
  const uniqueRatio = uniqueSet.size / sample.length;
  if (
    avgLen > 60 ||
    (avgLen > 25 && uniqueRatio > 0.7) ||
    (uniqueRatio > 0.8 && sample.length > 15)
  ) return COL_TYPES.TEXT;

  return COL_TYPES.CATEGORICAL;
}

export function analyzeColumn(name, allValues, type, totalRows) {
  const values = allValues.map((v) => String(v ?? "").trim());
  const nonEmpty = values.filter((v) => !isEmpty(v));
  const emptyCount = values.length - nonEmpty.length;
  const base = { name, type, totalCount: nonEmpty.length, emptyCount, totalRows };

  switch (type) {
    case COL_TYPES.CATEGORICAL: return { ...base, ...analyzeCategorical(nonEmpty) };
    case COL_TYPES.NUMERIC:     return { ...base, ...analyzeNumeric(nonEmpty) };
    case COL_TYPES.DATE:        return { ...base, ...analyzeDate(nonEmpty) };
    case COL_TYPES.LIKERT_NUM:  return { ...base, ...analyzeLikertNum(nonEmpty) };
    case COL_TYPES.LIKERT_TEXT: return { ...base, ...analyzeLikertText(nonEmpty) };
    case COL_TYPES.TEXT:        return { ...base, ...analyzeText(nonEmpty) };
    case COL_TYPES.MULTI_SELECT:return { ...base, ...analyzeMultiSelect(nonEmpty) };
    default:                    return { ...base, ...analyzeCategorical(nonEmpty) };
  }
}

function analyzeCategorical(values) {
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 10);
  const otherCount = sorted.slice(10).reduce((s, [, c]) => s + c, 0);

  const chartData = top.map(([label, count]) => ({
    label: label.length > 32 ? label.slice(0, 32) + "…" : label,
    fullLabel: label,
    count,
    pct: +((count / values.length) * 100).toFixed(1),
  }));
  if (otherCount > 0) {
    chartData.push({
      label: "Other",
      fullLabel: "Other",
      count: otherCount,
      pct: +((otherCount / values.length) * 100).toFixed(1),
    });
  }
  return { uniqueCount: Object.keys(counts).length, chartData, allValues: sorted.map(([v]) => v) };
}

function analyzeNumeric(values) {
  const nums = values
    .map((v) => parseFloat(v.replace(/[$€£¥₹₩,%]/g, "").replace(/,/g, "").trim()))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return { chartData: [], stats: null };

  nums.sort((a, b) => a - b);
  const n = nums.length;
  const min = nums[0];
  const max = nums[n - 1];
  const mean = nums.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (nums[n / 2 - 1] + nums[n / 2]) / 2 : nums[Math.floor(n / 2)];
  const stddev = Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n);

  const bucketCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(n))));
  const range = max - min || 1;
  const bSize = range / bucketCount;

  const chartData = Array.from({ length: bucketCount }, (_, i) => {
    const lo = min + i * bSize;
    const hi = min + (i + 1) * bSize;
    const count = nums.filter((v) =>
      i === bucketCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi
    ).length;
    return { label: fmtNum(lo) + "–" + fmtNum(hi), count, lo, hi };
  }).filter((b) => b.count > 0);

  const sum = nums.reduce((s, v) => s + v, 0);

  return {
    chartData,
    stats: {
      mean: +mean.toFixed(2),
      median: +median.toFixed(2),
      stddev: +stddev.toFixed(2),
      min: +min.toFixed(2),
      max: +max.toFixed(2),
      sum: +sum.toFixed(2),
    },
  };
}

function analyzeDate(values) {
  const dates = values
    .map((v) => tryParseDate(v))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (dates.length === 0) return { chartData: [], groupBy: "month" };

  const span = dates[dates.length - 1] - dates[0];
  const DAY = 86400000;
  const groupBy = span < 60 * DAY ? "day" : span < 730 * DAY ? "month" : "year";

  const counts = {};
  dates.forEach((d) => {
    const key =
      groupBy === "day" ? d.toISOString().slice(0, 10) :
      groupBy === "month" ? d.toISOString().slice(0, 7) :
      String(d.getFullYear());
    counts[key] = (counts[key] || 0) + 1;
  });

  const chartData = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));

  return { chartData, groupBy };
}

function analyzeLikertNum(values) {
  const nums = values.map(Number).filter((n) => !isNaN(n) && Number.isInteger(n));
  if (nums.length === 0) return { chartData: [], avg: 0 };

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const counts = {};
  for (let i = min; i <= max; i++) counts[i] = 0;
  nums.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });

  const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
  const chartData = Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([label, count]) => ({
      label,
      count,
      pct: +((count / nums.length) * 100).toFixed(1),
    }));

  const scaleMax = max <= 5 ? 5 : 10;
  return { chartData, avg: +avg.toFixed(2), scaleMin: min, scaleMax };
}

function analyzeLikertText(values) {
  const orderMap = Object.fromEntries(LIKERT_SCALE_WORDS.map((w, i) => [w, i]));
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => {
    const aRank = orderMap[a[0].toLowerCase()] ?? 999;
    const bRank = orderMap[b[0].toLowerCase()] ?? 999;
    return aRank - bRank;
  });

  const chartData = sorted.map(([label, count]) => ({
    label,
    count,
    pct: +((count / values.length) * 100).toFixed(1),
  }));

  return { chartData, uniqueCount: sorted.length };
}

function analyzeText(values) {
  const wordCounts = {};
  values.forEach((v) => {
    v.toLowerCase()
      .replace(/[^a-z\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w) && /^[a-z]/.test(w))
      .forEach((w) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
  });

  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([label, count]) => ({ label, count }));

  const avgLength = Math.round(values.reduce((s, v) => s + v.length, 0) / values.length);

  return {
    chartData: topWords,
    avgLength,
    sampleResponses: values.slice(0, 3).map((v) => v.slice(0, 200)),
  };
}

function analyzeMultiSelect(values) {
  const semiCount = values.filter((v) => v.includes(";")).length;
  const delimiter = semiCount > values.length * 0.3 ? ";" : ",";

  const counts = {};
  let totalMentions = 0;
  values.forEach((v) => {
    v.split(delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .forEach((option) => {
        counts[option] = (counts[option] || 0) + 1;
        totalMentions++;
      });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    totalMentions,
    chartData: sorted.slice(0, 15).map(([label, count]) => ({
      label: label.length > 35 ? label.slice(0, 35) + "…" : label,
      fullLabel: label,
      count,
      pct: +((count / values.length) * 100).toFixed(1),
    })),
    allOptions: sorted.map(([v]) => v),
    uniqueCount: sorted.length,
  };
}

// ─── Business KPI term sets for relevance scoring ────────────────────────────

const HIGH_VALUE_TERMS = [
  "revenue","sales","conversion","churn","nps","csat","satisfaction",
  "score","rating","cost","profit","margin","growth","retention",
  "mrr","arr","ltv","cac","roi","engagement","attendance","performance",
  "status","priority","stage","outcome","result","close","won","lost",
  "spend","budget","forecast","target","goal","kpi","metric",
];

const MEDIUM_VALUE_TERMS = [
  "date","time","period","month","quarter","year","region","segment",
  "category","type","source","channel","department","team","role","owner",
];

const CONTEXT_BOOST_TERMS = {
  sales:   ["revenue","deal","pipeline","close","stage","won","lost","account","opportunity","quota"],
  product: ["feature","adoption","engagement","retention","churn","usage","session","dau","mau","activation"],
  hr:      ["satisfaction","engagement","performance","tenure","headcount","attrition","hire","salary","comp"],
  finance: ["revenue","cost","profit","margin","expense","budget","forecast","cash","invoice","payment"],
  survey:  ["score","rating","satisfaction","nps","csat","feedback","recommend","experience","opinion"],
};

export function scoreColumnRelevance(col, context = {}) {
  let score = 0;
  const name = col.name.toLowerCase();

  if (HIGH_VALUE_TERMS.some((t) => name.includes(t))) score += 0.35;
  else if (MEDIUM_VALUE_TERMS.some((t) => name.includes(t))) score += 0.10;

  const completeness = col.totalRows > 0 ? col.totalCount / col.totalRows : 1;
  score += completeness * 0.15;

  const typeWeights = {
    [COL_TYPES.NUMERIC]:      0.25,
    [COL_TYPES.LIKERT_NUM]:   0.25,
    [COL_TYPES.LIKERT_TEXT]:  0.20,
    [COL_TYPES.CATEGORICAL]:  0.15,
    [COL_TYPES.DATE]:         0.10,
    [COL_TYPES.MULTI_SELECT]: 0.10,
    [COL_TYPES.TEXT]:         0.05,
  };
  score += typeWeights[col.type] || 0;

  if (context?.dataType) {
    const boostTerms = CONTEXT_BOOST_TERMS[context.dataType] || [];
    if (boostTerms.some((t) => name.includes(t))) score += 0.15;
  }

  return Math.min(1, score);
}

export function detectAnomalies(col) {
  switch (col.type) {
    case COL_TYPES.NUMERIC: {
      if (!col.stats) return null;
      const { mean, stddev, min, max } = col.stats;
      if (stddev === 0) return null;
      const threshold = 2.5 * stddev;
      if (max > mean + threshold) {
        return { type: "outlier_high", description: `Max value (${max.toLocaleString()}) is significantly above the mean (${mean.toLocaleString()})` };
      }
      if (min < mean - threshold) {
        return { type: "outlier_low", description: `Min value (${min.toLocaleString()}) is significantly below the mean (${mean.toLocaleString()})` };
      }
      return null;
    }
    case COL_TYPES.CATEGORICAL: {
      const top = col.chartData?.[0];
      if (top && top.pct >= 70) {
        return { type: "dominance", description: `"${top.fullLabel || top.label}" accounts for ${top.pct}% of responses — unusually high concentration` };
      }
      return null;
    }
    case COL_TYPES.LIKERT_NUM: {
      if (col.avg == null || !col.scaleMax) return null;
      const ratio = col.avg / col.scaleMax;
      if (ratio <= 0.3)  return { type: "low_score",  description: `Average score of ${col.avg}/${col.scaleMax} is notably low` };
      if (ratio >= 0.85) return { type: "high_score", description: `Average score of ${col.avg}/${col.scaleMax} is exceptionally high` };
      return null;
    }
    case COL_TYPES.LIKERT_TEXT: {
      const top = col.chartData?.[0];
      if (top && top.pct >= 60) {
        return { type: "dominance", description: `"${top.label}" is selected by ${top.pct}% of respondents` };
      }
      return null;
    }
    case COL_TYPES.DATE: {
      if (!col.chartData || col.chartData.length < 3) return null;
      const counts = col.chartData.map((d) => d.count);
      const avg = counts.reduce((s, c) => s + c, 0) / counts.length;
      const maxCount = Math.max(...counts);
      if (maxCount > avg * 3) {
        const spike = col.chartData[counts.indexOf(maxCount)];
        return { type: "spike", description: `Spike in ${spike.label}: ${spike.count} entries vs avg of ${Math.round(avg)}` };
      }
      return null;
    }
    default:
      return null;
  }
}

export function generateInsightSentence(col) {
  switch (col.type) {
    case COL_TYPES.NUMERIC: {
      if (!col.stats) return `${col.name}: ${col.totalCount.toLocaleString()} records.`;
      const { mean, median, min, max, sum } = col.stats;
      if (sum != null && mean >= 1000) {
        // Large-value metric (currency, revenue, counts) — total is the headline number
        return `Total: ${fmtNum(sum)} · Median: ${fmtNum(median)} · Range: ${fmtNum(min)}–${fmtNum(max)}`;
      }
      return `Mean: ${fmtNum(mean)} · Median: ${fmtNum(median)} · Range: ${fmtNum(min)}–${fmtNum(max)}`;
    }
    case COL_TYPES.LIKERT_NUM: {
      if (col.avg == null) return `${col.name}: ${col.totalCount.toLocaleString()} responses.`;
      const ratio = col.avg / (col.scaleMax || 10);
      const sentiment = ratio >= 0.7 ? "positive" : ratio >= 0.45 ? "moderate" : "low";
      return `Avg ${col.avg} / ${col.scaleMax || 10} — ${sentiment} sentiment across ${col.totalCount.toLocaleString()} responses.`;
    }
    case COL_TYPES.LIKERT_TEXT: {
      const top = col.chartData?.[0];
      if (!top) return `${col.name}: ${col.totalCount.toLocaleString()} responses.`;
      return `${top.pct}% selected "${top.label}" — ${col.totalCount.toLocaleString()} responses total.`;
    }
    case COL_TYPES.CATEGORICAL: {
      const data = col.chartData;
      if (!data?.length) return `${col.name}: ${col.uniqueCount} unique values.`;
      // Show top values as a distribution — far more useful than "most common"
      const real = data.filter((d) => d.label !== "Other");
      const top = real.slice(0, 4);
      const parts = top.map((d) => `${d.fullLabel || d.label} (${d.pct}%)`).join(" · ");
      const remaining = col.uniqueCount - top.length;
      return remaining > 0 ? `${parts} · +${remaining} more` : parts;
    }
    case COL_TYPES.DATE: {
      const data = col.chartData;
      if (!data?.length) return `${col.name}: no dated records.`;
      const first = data[0].label;
      const last = data[data.length - 1].label;
      const peak = data.reduce((a, b) => (a.count > b.count ? a : b));
      if (first === last) return `${col.name}: all records in ${first}.`;
      return `${first} – ${last} · peak in ${peak.label} (${peak.count.toLocaleString()} records)`;
    }
    case COL_TYPES.MULTI_SELECT: {
      const top = col.chartData?.[0];
      if (!top) return `${col.name}: varied selections.`;
      return `"${top.fullLabel || top.label}" leads with ${top.count.toLocaleString()} mentions (${top.pct}% of rows).`;
    }
    case COL_TYPES.TEXT: {
      const topWord = col.chartData?.[0];
      if (!topWord) return `${col.name}: free-text responses.`;
      return `Top theme: "${topWord.label}" (${topWord.count}×) — avg ${col.avgLength} chars per response.`;
    }
    default:
      return `${col.name}: ${col.totalCount.toLocaleString()} records.`;
  }
}

export function getColumnValues(rows, columnName) {
  return rows.map((row) => row[columnName]);
}

// ─── URL dimension extraction ─────────────────────────────────────────────────

function extractURLDimensions(urlStr) {
  try {
    const u = new URL(urlStr);
    const hostParts = u.hostname.split(".");
    // Subdomain is everything before the registrable domain (last two parts)
    const subdomain = hostParts.length > 2
      ? hostParts.slice(0, -2).join(".")
      : "(root domain)";
    const segments = u.pathname.split("/").filter(Boolean);
    const section = segments[0] || "(homepage)";
    const depth = segments.length;
    const depthLabel =
      depth === 0 ? "Homepage" :
      depth === 1 ? "1 level" :
      depth === 2 ? "2 levels" : "3+ levels";
    return { subdomain, section, depth: depthLabel };
  } catch {
    return { subdomain: "(unknown)", section: "(unknown)", depth: "(unknown)" };
  }
}

// Detects URL columns and adds derived categorical dimensions directly to each row.
// Returns an array of {name, type, derived: true} for use in groupableColumns.
// Mutates rows in-place (safe to call before setting state).
export function augmentWithURLDimensions(rows, headers) {
  const urlHeaders = headers.filter((h) => {
    const sample = rows.slice(0, 50).map((r) => String(r[h] ?? "").trim()).filter(Boolean);
    if (sample.length < 3) return false;
    return sample.filter((v) => /^https?:\/\//i.test(v)).length / sample.length > 0.7;
  });

  if (!urlHeaders.length) return [];

  const addedColumns = [];

  urlHeaders.forEach((h) => {
    const cols = [
      { name: `${h} / subdomain`, dim: "subdomain" },
      { name: `${h} / section`,   dim: "section" },
      { name: `${h} / depth`,     dim: "depth" },
    ];

    // Single pass — compute all three dimensions per row
    rows.forEach((row) => {
      const url = String(row[h] ?? "").trim();
      const dims = url ? extractURLDimensions(url) : { subdomain: "(unknown)", section: "(unknown)", depth: "(unknown)" };
      cols.forEach(({ name, dim }) => { row[name] = dims[dim]; });
    });

    cols.forEach(({ name }) =>
      addedColumns.push({ name, type: COL_TYPES.CATEGORICAL, derived: true })
    );
  });

  return addedColumns;
}

// ─── Time-ordered label detection ────────────────────────────────────────────

const MONTH_RANK = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6,
  aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const QUARTER_RANK = {
  q1: 0, q2: 1, q3: 2, q4: 3,
  "quarter 1": 0, "quarter 2": 1, "quarter 3": 2, "quarter 4": 3,
};

function getTimeRank(label) {
  const l = String(label).toLowerCase().trim();
  if (l in MONTH_RANK) return MONTH_RANK[l];
  if (l in QUARTER_RANK) return QUARTER_RANK[l];
  const y = parseInt(l);
  if (!isNaN(y) && y > 1900 && y < 2200) return y;
  return null;
}

// Returns true when every label in the array is a recognisable time period
// (month name, quarter, or year). Used by ColumnCard to pick the right chart type.
export function isTimeOrderedLabels(labels) {
  if (!labels || labels.length === 0) return false;
  return labels.every((l) => getTimeRank(l) !== null);
}

// Groups a numeric column by a categorical column and returns per-group means.
// Used by the breakdown / "Compare by" feature in ColumnCard.
export function computeBreakdown(rows, metricCol, groupByCol) {
  const groups = {};
  rows.forEach((row) => {
    const group = String(row[groupByCol] ?? "").trim();
    if (!group || isEmpty(group)) return;
    const raw = String(row[metricCol] ?? "").trim();
    const val = parseFloat(raw.replace(/[$€£¥₹₩,%]/g, "").replace(/,/g, "").trim());
    if (isNaN(val)) return;
    if (!groups[group]) groups[group] = { sum: 0, count: 0 };
    groups[group].sum += val;
    groups[group].count++;
  });

  const results = Object.entries(groups)
    .filter(([, { count }]) => count > 0)
    .map(([label, { sum, count }]) => ({
      label: label.length > 28 ? label.slice(0, 28) + "…" : label,
      fullLabel: label,
      mean: +(sum / count).toFixed(2),
      count,
    }));

  // Sort chronologically for time-period labels (months, quarters, years);
  // fall back to descending mean for everything else.
  const ranks = results.map((r) => getTimeRank(r.fullLabel ?? r.label));
  const allRanked = ranks.every((r) => r !== null);
  if (allRanked) {
    results.sort((a, b) => ranks[results.indexOf(a)] - ranks[results.indexOf(b)]);
  } else {
    results.sort((a, b) => b.mean - a.mean);
  }

  return results.slice(0, 12);
}

// Groups a numeric column by a date column, returning mean per time period.
// Used by the "Compare by → date column" (over time) feature in ColumnCard.
export function computeTimeSeriesBreakdown(rows, metricCol, dateCol) {
  const dated = rows
    .map((row) => {
      const d = tryParseDate(String(row[dateCol] ?? ""));
      const raw = String(row[metricCol] ?? "").trim();
      const val = parseFloat(raw.replace(/[$€£¥₹₩,%]/g, "").replace(/,/g, "").trim());
      return d && !isNaN(val) ? { date: d, val } : null;
    })
    .filter(Boolean);

  if (!dated.length) return [];

  dated.sort((a, b) => a.date - b.date);
  const span = dated[dated.length - 1].date - dated[0].date;
  const DAY = 86400000;
  const groupBy = span < 60 * DAY ? "day" : span < 730 * DAY ? "month" : "year";

  const groups = {};
  dated.forEach(({ date, val }) => {
    const key =
      groupBy === "day"   ? date.toISOString().slice(0, 10) :
      groupBy === "month" ? date.toISOString().slice(0, 7)  :
                            String(date.getFullYear());
    if (!groups[key]) groups[key] = { sum: 0, count: 0 };
    groups[key].sum += val;
    groups[key].count++;
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { sum, count }]) => ({
      label,
      mean: +(sum / count).toFixed(2),
      count,
    }));
}

export function applyFilters(rows, filters) {
  if (Object.keys(filters).length === 0) return rows;
  return rows.filter((row) =>
    Object.entries(filters).every(([col, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) return true;
      return selectedValues.includes(String(row[col] ?? "").trim());
    })
  );
}

function fmtNum(n) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
