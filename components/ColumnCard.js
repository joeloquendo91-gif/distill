"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";
import { COL_TYPES } from "@/lib/csvParser";

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
  [COL_TYPES.CATEGORICAL]:  "bg-indigo-500/20 text-indigo-300",
  [COL_TYPES.NUMERIC]:      "bg-violet-500/20 text-violet-300",
  [COL_TYPES.DATE]:         "bg-cyan-500/20 text-cyan-300",
  [COL_TYPES.LIKERT_NUM]:   "bg-amber-500/20 text-amber-300",
  [COL_TYPES.LIKERT_TEXT]:  "bg-amber-500/20 text-amber-300",
  [COL_TYPES.TEXT]:         "bg-rose-500/20 text-rose-300",
  [COL_TYPES.MULTI_SELECT]: "bg-emerald-500/20 text-emerald-300",
};

const CAT_PALETTE = [
  "#6366f1","#8b5cf6","#a78bfa","#ec4899","#f59e0b",
  "#10b981","#06b6d4","#f97316","#84cc16","#14b8a6",
];

function likertColor(idx, total) {
  if (total <= 1) return "#6366f1";
  const pos = idx / (total - 1);
  if (pos <= 0.2) return "#ef4444";
  if (pos <= 0.4) return "#f97316";
  if (pos <= 0.6) return "#94a3b8";
  if (pos <= 0.8) return "#34d399";
  return "#10b981";
}

function Tooltip$({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-medium mb-0.5 max-w-[180px] break-words">{d.fullLabel || label}</p>
      <p className="text-slate-300">{payload[0].value?.toLocaleString()} responses</p>
      {d.pct !== undefined && <p className="text-slate-500">{d.pct}%</p>}
    </div>
  );
}

function CategoricalChart({ chartData }) {
  const horizontal = chartData.length > 4 || chartData.some((d) => d.label.length > 8);
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(100, chartData.length * 30)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={110} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
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
            <div key={lbl} className="bg-white/3 rounded-lg p-2 text-center">
              <div className="text-[10px] text-slate-500">{lbl}</div>
              <div className="text-xs font-semibold text-white mt-0.5">{val?.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function DateChart({ chartData }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<Tooltip$ />} />
        <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} fill="url(#dateGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LikertChart({ column }) {
  const { chartData, avg, scaleMax } = column;
  return (
    <>
      {avg !== undefined && (
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-white">{avg}</span>
          <span className="text-slate-500 text-sm">/ {scaleMax || chartData.length}</span>
          <span className="text-xs text-slate-500 ml-1">avg</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 30)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={90} />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={likertColor(i, chartData.length)} />
            ))}
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
      <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Top words</p>
      <ResponsiveContainer width="100%" height={Math.max(80, Math.min(10, chartData.length) * 22)}>
        <BarChart data={chartData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip content={<Tooltip$ />} />
          <Bar dataKey="count" fill="#f43f5e" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {sampleResponses?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {sampleResponses.slice(0, 2).map((r, i) => (
            <p key={i} className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">"{r}"</p>
          ))}
        </div>
      )}
      {avgLength && (
        <p className="text-xs text-slate-600 mt-2">Avg response: {avgLength} chars</p>
      )}
    </>
  );
}

export default function ColumnCard({ column, onTypeChange }) {
  const { name, type, totalCount, emptyCount, totalRows, chartData } = column;
  const completeness = totalRows > 0 ? Math.round((totalCount / totalRows) * 100) : 100;
  const hasData = chartData && chartData.length > 0;

  return (
    <div className="bg-[#16162a] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white leading-snug flex-1 min-w-0 truncate" title={name}>
          {name}
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${TYPE_BADGE[type] || "bg-gray-500/20 text-gray-300"}`}>
          {TYPE_LABELS[type] || type}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4 text-[11px]">
        <span className="text-slate-400">{totalCount.toLocaleString()} responses</span>
        {emptyCount > 0 && (
          <span className="text-amber-500">{emptyCount} missing</span>
        )}
        {completeness < 100 && (
          <span className="text-slate-600">{completeness}% complete</span>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1">
        {!hasData ? (
          <div className="h-24 flex items-center justify-center text-slate-600 text-xs">
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

      {/* Footer stats */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-600">
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
