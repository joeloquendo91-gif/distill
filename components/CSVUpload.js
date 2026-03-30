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
            ? "border-green-400 bg-green-50"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
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
            <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 text-sm">{loadingMessage || "Processing…"}</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-900 font-medium mb-1">
              Drop your CSV here, or <span className="text-green-600 underline">browse</span>
            </p>
            <p className="text-gray-400 text-sm">CSV · TSV · up to 1,000 rows free</p>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">
        Your data never leaves your browser. No uploads to any server.
      </p>
    </div>
  );
}
