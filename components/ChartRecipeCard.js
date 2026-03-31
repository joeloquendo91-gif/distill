"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
  PieChart, Pie,
} from "recharts";
import { computeChartData } from "@/lib/csvParser";

const PALETTE = [
  "#378ADD", "#1D9E75", "#D85A30", "#D4537E",
  "#BA7517", "#639922", "#7C5CBF", "#0891B2",
];

function fmtVal(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1000) return (n / 1000).toFixed(1) + "K";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function SimpleTooltip({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-700 font-medium mb-0.5 max-w-[180px] break-words">{d.fullLabel || label}</p>
      <p className="text-gray-900 font-semibold">{fmtVal(payload[0].value)}</p>
      {d.count !== undefined && <p className="text-gray-400">{d.count.toLocaleString()} records</p>}
    </div>
  );
}

function StackedTooltip({ active, payload, label, is100 }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg max-w-[200px]">
      <p className="text-gray-700 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="leading-snug" style={{ color: p.fill }}>
          {p.name}: {is100 ? p.value + "%" : fmtVal(p.value)}
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-700 font-medium">{d.name}</p>
      <p className="text-gray-900 font-semibold">{fmtVal(d.value)}</p>
      <p className="text-gray-400">{d.payload.pct}%</p>
    </div>
  );
}

function SeriesLegend({ series }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
      {series.map((s, i) => (
        <span key={s.name} className="flex items-center gap-1 text-[10px] text-gray-500">
          <span
            className="w-2 h-2 rounded-sm inline-block shrink-0"
            style={{ background: PALETTE[i % PALETTE.length] }}
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function SimpleBarChart({ data }) {
  const items = data.entries.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={items} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis hide tickFormatter={fmtVal} />
        <Tooltip content={<SimpleTooltip />} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {items.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data }) {
  const items = data.entries.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, items.length * 34)}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <XAxis type="number" hide tickFormatter={fmtVal} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<SimpleTooltip />} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {items.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChart({ data }) {
  const items = data.entries;
  const tickInterval = items.length > 8 ? Math.ceil(items.length / 5) - 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={items} margin={{ top: 5, right: 16, bottom: 16, left: 16 }}>
        <defs>
          <linearGradient id="recipeLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
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
        <YAxis hide tickFormatter={fmtVal} />
        <Tooltip content={<SimpleTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#1D9E75"
          strokeWidth={2}
          fill="url(#recipeLineGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }) {
  const total = data.entries.reduce((s, e) => s + e.value, 0);
  const items = data.entries.slice(0, 6).map((e) => ({
    ...e,
    name: e.label,
    pct: total > 0 ? Math.round((e.value / total) * 100) : 0,
  }));
  return (
    <>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius="48%"
            outerRadius="76%"
            paddingAngle={2}
          >
            {items.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend: name + value + pct — makes the donut readable without hovering */}
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate">{item.fullLabel || item.name}</span>
            </span>
            <span className="text-gray-700 font-medium ml-3 shrink-0">
              {fmtVal(item.value)}{" "}
              <span className="text-gray-400 font-normal">({item.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function StackedBarChart({ data }) {
  const { xLabels, series, is100 } = data;

  // Reshape into Recharts format: [{label, SeriesA: val, SeriesB: val, ...}]
  const chartData = xLabels.map((label, xi) => {
    const obj = { label };
    series.forEach((s) => { obj[s.name] = s.values[xi]; });
    return obj;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={is100 ? (v) => v + "%" : fmtVal}
          domain={is100 ? [0, 100] : undefined}
          width={36}
        />
        <Tooltip content={<StackedTooltip is100={is100} />} />
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="stack"
            fill={PALETTE[i % PALETTE.length]}
            radius={i === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ChartRecipeCard({ recipe, rows }) {
  const chartData = useMemo(
    () => (rows?.length ? computeChartData(rows, recipe) : null),
    [rows, recipe]
  );

  if (!chartData) return null;

  const isStacked = chartData.type === "stacked";
  const hasData = isStacked ? chartData.series?.length > 0 : chartData.entries?.length > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all">
      {/* Header */}
      <div className="mb-3">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{recipe.question}</p>
        <p className="text-sm font-semibold text-gray-900 leading-snug">{recipe.title}</p>
        {recipe.subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5">{recipe.subtitle}</p>
        )}
      </div>

      {/* Multi-series legend */}
      {isStacked && chartData.series?.length > 0 && (
        <SeriesLegend series={chartData.series} />
      )}

      {/* Chart */}
      {!hasData ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-xs">
          No data for this combination
        </div>
      ) : recipe.chartType === "bar" ? (
        <SimpleBarChart data={chartData} />
      ) : recipe.chartType === "bar_horizontal" ? (
        <HorizontalBarChart data={chartData} />
      ) : recipe.chartType === "line" ? (
        <LineChart data={chartData} />
      ) : recipe.chartType === "donut" ? (
        <DonutChart data={chartData} />
      ) : (recipe.chartType === "stacked_100" || recipe.chartType === "stacked_absolute") ? (
        <StackedBarChart data={chartData} />
      ) : (
        <SimpleBarChart data={chartData} />
      )}
    </div>
  );
}
