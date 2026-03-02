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
  if (commaMultiCount > sample.length * 0.4) return COL_TYPES.MULTI_SELECT;

  // Likert text
  const likertTextCount = sample.filter((v) =>
    LIKERT_SCALE_WORDS.some(
      (w) => w === v.toLowerCase() || v.toLowerCase().includes(w)
    )
  ).length;
  if (likertTextCount > sample.length * 0.5 && uniqueSet.size <= 10) {
    return COL_TYPES.LIKERT_TEXT;
  }

  // Numeric
  const numericCount = sample.filter(
    (v) => !isNaN(parseFloat(v.replace(/,/g, ""))) && isFinite(Number(v.replace(/,/g, "")))
  ).length;
  if (numericCount > sample.length * 0.85) {
    const nums = sample
      .map((v) => parseFloat(v.replace(/,/g, "")))
      .filter((n) => !isNaN(n));
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const uniqueNums = new Set(nums.map(Math.round));
    const allIntegers = nums.every((n) => Math.abs(n - Math.round(n)) < 0.001);
    if (min >= 1 && max <= 10 && allIntegers && uniqueNums.size <= 10 && max - min <= 9) {
      return COL_TYPES.LIKERT_NUM;
    }
    return COL_TYPES.NUMERIC;
  }

  // Date
  const dateCount = sample.filter((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && /\d{4}|\d{1,2}[\/\-]\d{1,2}/.test(v);
  }).length;
  if (dateCount > sample.length * 0.75) return COL_TYPES.DATE;

  // Long text (free response)
  const avgLen = sample.reduce((s, v) => s + v.length, 0) / sample.length;
  const uniqueRatio = uniqueSet.size / nonEmpty.length;
  if (avgLen > 60 || (avgLen > 25 && uniqueRatio > 0.7)) return COL_TYPES.TEXT;

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
    .map((v) => parseFloat(v.replace(/,/g, "")))
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

  return {
    chartData,
    stats: {
      mean: +mean.toFixed(2),
      median: +median.toFixed(2),
      stddev: +stddev.toFixed(2),
      min: +min.toFixed(2),
      max: +max.toFixed(2),
    },
  };
}

function analyzeDate(values) {
  const dates = values
    .map((v) => new Date(v))
    .filter((d) => !isNaN(d.getTime()))
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

  return { chartData, avg: +avg.toFixed(2), scaleMin: min, scaleMax: max };
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

export function getColumnValues(rows, columnName) {
  return rows.map((row) => row[columnName]);
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
