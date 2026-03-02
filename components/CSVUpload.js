"use client";
import { useRef, useState } from "react";

export default function CSVUpload({ onUpload, loading, loadingMessage }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      alert("Please upload a CSV file.");
      return;
    }
    onUpload(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  return (
    <div className="w-full max-w-xl">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${dragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/4"
          }
          ${loading ? "cursor-not-allowed opacity-70" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300 text-sm">{loadingMessage || "Processing…"}</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-4">📊</div>
            <p className="text-white font-medium mb-1">
              Drop your CSV here, or <span className="text-indigo-400 underline">browse</span>
            </p>
            <p className="text-slate-500 text-sm">CSV · TSV · up to 1,000 rows free</p>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 mt-3">
        Your data never leaves your browser. No uploads to any server.
      </p>
    </div>
  );
}
