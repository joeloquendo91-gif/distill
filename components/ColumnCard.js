"use client";
import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell, LabelList,
} from "recharts";
import { COL_TYPES, computeBreakdown, computeTimeSeriesBreakdown, isTimeOrderedLabels } from "@/lib/csvParser";

const TYPE_LABELS = {
  [COL_TYPES.CATEGORICAL]:  "Categorical",
  [COL_TYPES.NUMERIC]:      "Numeric",
  [COL_TYPES.DATE]:         "Date",
  [COL_TYPES.LIKERT_NUM]:   "Likert",
  [COL_TYPES.LIKERT_TEXT]:  "Likert",
  [COL_TYPES.TEXT]:         "Text",
  [COL_TYPES.MULTI_SELECT]: "Multi-select",
};

const TYPE_BADGE = {
  [COL_TYPES.CATEGORICAL]:  "bg-indigo-50 text-indigo-600",
  [COL_TYPES.NUMERIC]:      "bg-violet-50 text-violet-600",
  [COL_TYPES.DATE]:         "bg-cyan-50 text-cyan-700",
  [COL_TYPES.LIKERT_NUM]:   "bg-amber-50 text-amber-700",
  [COL_TYPES.LIKERT_TEXT]:  "bg-amber-50 text-amber-700",
  [COL_TYPES.TEXT]:         "bg-rose-50 text-rose-600",
  [COL_TYPES.MULTI_SELECT]: "bg-emerald-50 text-emerald-700",
};

const CAT_PALETTE = [
  "#6366f1","#8b5cf6","#a78bfa","#ec4899","#f59e0b",
  "#10b981","#06b6d4","#f97316","#84cc16","#14b8a6",
];

// pos: 0 = worst/lowest (red), 1 = best/highest (green)
function likertColor(pos) {
  if (pos <= 0.2) return "#ef4444";
  if (pos <= 0.4) return "#f97316";
  if (pos <= 0.6) return "#94a3b8";
  if (pos <= 0.8) return "#34d399";
  return "#10b981";
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Tooltip$({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-900 font-medium mb-0.5 max-w-[180px] break-words">{d.fullLabel || label}</p>
      <p className="text-gray-500">{payload[0].value?.toLocaleString()} responses</p>
      {d.pct !== undefined && <p className="text-gray-400">{d.pct}%</p>}
    </div>
  );
}

function BreakdownTooltip({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-900 font-medium mb-0.5 max-w-[180px] break-words">{d.fullLabel || label}</p>
      <p className="text-gray-600">Avg: {fmtNum(d.mean)}</p>
      <p className="text-gray-400">{d.count} responses</p>
    </div>
  );
}

function BreakdownChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(80, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip content={<BreakdownTooltip />} />
        <Bar dataKey="mean" fill="#6366f1" radius={[0, 3, 3, 0]}>
          <LabelList
            dataKey="mean"
            position="right"
            style={{ fontSize: 10, fill: "#6b7280" }}
            formatter={(v) => fmtNum(v)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimeSeriesBreakdownChart({ data }) {
  const tickInterval = data.length > 8 ? Math.ceil(data.length / 5) - 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 16, bottom: 20, left: 16 }}>
        <defs>
          <linearGradient id="tsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis hide />
        <Tooltip content={<BreakdownTooltip />} />
        <Area type="monotone" dataKey="mean" stroke="#6366f1" strokeWidth={2} fill="url(#tsGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CategoricalChart({ chartData }) {
  const horizontal = chartData.length > 4 || chartData.some((d) => d.label.length > 8);
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(100, chartData.length * 30)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={110} />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={CAT_PALETTE[i % CAT_PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<Tooltip$ />} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {chartData.map((_, i) => <Cell key={i} fill={CAT_PALETTE[i % CAT_PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function NumericChart({ column }) {
  const { chartData, stats } = column;
  return (
    <>
      {stats && (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[["Mean", stats.mean], ["Median", stats.median], ["Std dev", stats.stddev]].map(([lbl, val]) => (
            <div key={lbl} className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-500">{lbl}</div>
              <div className="text-xs font-semibold text-gray-900 mt-0.5">{val?.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" hide />
          <YAxis hide />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function DateChart({ chartData }) {
  const tickInterval = chartData.length > 8 ? Math.ceil(chartData.length / 5) - 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 5, right: 16, bottom: 0, left: 16 }}>
        <defs>
          <linearGradient id="dateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis hide />
        <Tooltip content={<Tooltip$ />} />
        <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} fill="url(#dateGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LikertChart({ column }) {
  const { type, chartData, avg, scaleMax, scaleMin } = column;
  return (
    <>
      {avg !== undefined && (
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-gray-900">{avg}</span>
          <span className="text-gray-500 text-sm">/ {scaleMax || chartData.length}</span>
          <span className="text-xs text-gray-400 ml-1">avg</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 30)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={90} />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]}>
            {chartData.map((d, i) => {
              let pos;
              if (type === COL_TYPES.LIKERT_NUM && scaleMin != null && scaleMax != null && scaleMax > scaleMin) {
                pos = (Number(d.label) - scaleMin) / (scaleMax - scaleMin);
              } else if (type === COL_TYPES.LIKERT_TEXT) {
                pos = 1 - i / Math.max(1, chartData.length - 1);
              } else {
                pos = i / Math.max(1, chartData.length - 1);
              }
              return <Cell key={i} fill={likertColor(pos)} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function TextChart({ column }) {
  const { chartData, sampleResponses, avgLength } = column;
  return (
    <>
      <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Top words</p>
      <ResponsiveContainer width="100%" height={Math.max(80, Math.min(10, chartData.length) * 22)}>
        <BarChart data={chartData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" fill="#f43f5e" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {sampleResponses?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {sampleResponses.slice(0, 2).map((r, i) => (
            <p key={i} className="text-xs text-gray-500 italic leading-relaxed line-clamp-2">"{r}"</p>
          ))}
        </div>
      )}
      {avgLength && (
        <p className="text-xs text-gray-500 mt-2">Avg response: {avgLength} chars</p>
      )}
    </>
  );
}

// Columns that support breakdown (numeric metric that can be grouped)
const BREAKDOWN_TYPES = new Set([COL_TYPES.NUMERIC, COL_TYPES.LIKERT_NUM]);

export default function ColumnCard({
  column,
  onTypeChange,
  // Breakdown props (optional — only on dashboard, not share page)
  filteredRows = [],
  // groupableColumns: [{name, type}] — both categorical and date columns
  groupableColumns = [],
  activeBreakdown = null,
  onBreakdownChange,
}) {
  const { name, type, totalCount, emptyCount, totalRows, chartData } = column;
  const completeness = totalRows > 0 ? Math.round((totalCount / totalRows) * 100) : 100;
  const hasData = chartData && chartData.length > 0;

  const categoricalGroupables = groupableColumns.filter((c) => c.type === COL_TYPES.CATEGORICAL && !c.derived);
  const derivedGroupables = groupableColumns.filter((c) => c.derived);
  const dateGroupables = groupableColumns.filter((c) => c.type === COL_TYPES.DATE);

  // Local breakdown state — syncs when a suggestion chip fires from parent
  const [breakdownCol, setBreakdownCol] = useState(activeBreakdown);
  useEffect(() => {
    setBreakdownCol(activeBreakdown);
  }, [activeBreakdown]);

  // Use the time series chart when the groupBy is a date column OR when the
  // breakdown labels are recognised time periods (months, quarters, years).
  const isDateColumn = breakdownCol
    ? groupableColumns.find((c) => c.name === breakdownCol)?.type === COL_TYPES.DATE
    : false;

  const breakdownData = useMemo(() => {
    if (!breakdownCol || !filteredRows.length) return null;
    return isDateColumn
      ? computeTimeSeriesBreakdown(filteredRows, name, breakdownCol)
      : computeBreakdown(filteredRows, name, breakdownCol);
  }, [breakdownCol, filteredRows, name, isDateColumn]);

  // True when breakdown should render as a time-ordered area chart
  const isTimeSeries = isDateColumn ||
    (breakdownData?.length > 0 && isTimeOrderedLabels(breakdownData.map((d) => d.label)));

  function handleBreakdownChange(groupBy) {
    const val = groupBy || null;
    setBreakdownCol(val);
    onBreakdownChange?.(val);
  }

  const canBreakdown = BREAKDOWN_TYPES.has(type) && groupableColumns.length > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug truncate" title={name}>
            {name}
          </h3>
          {column.reconDescription && (
            <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={column.reconDescription}>
              {column.reconDescription}
            </p>
          )}
        </div>
        {onTypeChange ? (
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            title="Change detected type"
            className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium cursor-pointer border-0 outline-none bg-transparent ${TYPE_BADGE[type] || "bg-gray-100 text-gray-500"}`}
          >
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        ) : (
          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${TYPE_BADGE[type] || "bg-gray-100 text-gray-500"}`}>
            {TYPE_LABELS[type] || type}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4 text-[11px] mt-2">
        <span className="text-gray-400">{totalCount.toLocaleString()} responses</span>
        {emptyCount > 0 && (
          <span className="text-amber-600">{emptyCount} missing</span>
        )}
        {completeness < 100 && (
          <span className="text-gray-500">{completeness}% complete</span>
        )}
      </div>

      {/* Chart area — breakdown replaces the regular chart when active */}
      <div className="flex-1">
        {breakdownCol && breakdownData?.length > 0 ? (
          isTimeSeries
            ? <TimeSeriesBreakdownChart data={breakdownData} />
            : <BreakdownChart data={breakdownData} />
        ) : breakdownCol && breakdownData?.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-gray-500 text-xs">
            No data for this combination
          </div>
        ) : !hasData ? (
          <div className="h-24 flex items-center justify-center text-gray-400 text-xs">
            No data to display
          </div>
        ) : type === COL_TYPES.CATEGORICAL || type === COL_TYPES.MULTI_SELECT ? (
          <CategoricalChart chartData={chartData} />
        ) : type === COL_TYPES.NUMERIC ? (
          <NumericChart column={column} />
        ) : type === COL_TYPES.DATE ? (
          <DateChart chartData={chartData} />
        ) : type === COL_TYPES.LIKERT_NUM || type === COL_TYPES.LIKERT_TEXT ? (
          <LikertChart column={column} />
        ) : type === COL_TYPES.TEXT ? (
          <TextChart column={column} />
        ) : null}
      </div>

      {/* Compare by selector — numeric/likert_num columns only */}
      {canBreakdown && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 shrink-0">Compare by</span>
            <select
              value={breakdownCol || ""}
              onChange={(e) => handleBreakdownChange(e.target.value)}
              className="flex-1 text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none cursor-pointer min-w-0"
            >
              <option value="">— distribution —</option>
              {categoricalGroupables.length > 0 && (
                <optgroup label="Group by">
                  {categoricalGroupables.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {derivedGroupables.length > 0 && (
                <optgroup label="URL breakdowns">
                  {derivedGroupables.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {dateGroupables.length > 0 && (
                <optgroup label="Over time">
                  {dateGroupables.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {breakdownCol && (
              <button
                onClick={() => handleBreakdownChange(null)}
                className="text-[10px] text-gray-400 hover:text-gray-700 shrink-0"
                title="Clear breakdown"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className={`${canBreakdown ? "mt-2" : "mt-4"} pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500`}>
        {(type === COL_TYPES.CATEGORICAL || type === COL_TYPES.MULTI_SELECT) && (
          <>
            <span>{(column.uniqueCount || 0).toLocaleString()} unique values</span>
            {column.totalMentions && (
              <span>{column.totalMentions.toLocaleString()} total mentions</span>
            )}
          </>
        )}
        {type === COL_TYPES.NUMERIC && column.stats && (
          <span>Range: {column.stats.min} – {column.stats.max}</span>
        )}
        {(type === COL_TYPES.LIKERT_NUM || type === COL_TYPES.LIKERT_TEXT) && (
          <span>{(column.uniqueCount || chartData?.length || 0)} scale points</span>
        )}
      </div>
    </div>
  );
}
