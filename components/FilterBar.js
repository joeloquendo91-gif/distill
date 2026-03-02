"use client";
import { useState, useRef, useEffect } from "react";

function FilterDropdown({ column, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const values = column.allValues || column.chartData?.map((d) => d.fullLabel || d.label) || [];
  const activeCount = selected?.length || 0;

  function toggle(val) {
    if (!selected) {
      onChange([val]);
    } else if (selected.includes(val)) {
      const next = selected.filter((v) => v !== val);
      onChange(next.length === 0 ? null : next);
    } else {
      onChange([...selected, val]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
          border transition-colors whitespace-nowrap
          ${activeCount > 0
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }
        `}
      >
        <span className="truncate max-w-[100px]">{column.name}</span>
        {activeCount > 0 && (
          <span className="bg-green-500 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
            {activeCount}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[180px] max-h-64 overflow-y-auto">
          {values.slice(0, 50).map((val) => (
            <label
              key={val}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected?.includes(val) || false}
                onChange={() => toggle(val)}
                className="accent-green-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-700 truncate">{val}</span>
            </label>
          ))}
          {values.length > 50 && (
            <p className="text-xs text-gray-400 px-2 py-1">+{values.length - 50} more values</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ columns, filters, onFilterChange, onClear }) {
  const activeCount = Object.keys(filters).length;

  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <span className="text-xs text-gray-500 shrink-0">Filter by:</span>
      {columns.map((col) => (
        <FilterDropdown
          key={col.name}
          column={col}
          selected={filters[col.name] || null}
          onChange={(vals) => onFilterChange(col.name, vals)}
        />
      ))}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700 ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
