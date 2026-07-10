'use client';

import React from 'react';
import { CheckCircle2, Download, XCircle } from 'lucide-react';
import type { BulkImportSummary } from '@/services/product-import';

interface ImportResultSummaryProps {
  summary: BulkImportSummary;
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Returns "Xms" for durations under 1 second, or "X.Xs" for longer durations.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Downloads the import summary as a JSON file.
 */
function downloadReport(summary: BulkImportSummary): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `bulk-import-report-${timestamp}.json`;
  const json = JSON.stringify(summary, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Displays the outcome of a completed bulk import, including aggregate counts,
 * timing, throughput, and a detailed failure list with error codes.
 */
export default function ImportResultSummary({ summary }: ImportResultSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Success line */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
        <span className="text-[13px] font-medium text-zinc-800">
          ✓ {summary.successCount} of {summary.successCount + summary.failureCount} products imported successfully
        </span>
      </div>

      {/* Metric chips */}
      <div className="flex flex-wrap gap-3">
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          {summary.productsCreated} Product{summary.productsCreated === 1 ? '' : 's'} Created
        </div>
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          {summary.colorsCreated} Color{summary.colorsCreated === 1 ? '' : 's'} Created
        </div>
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          {summary.mediaCreated} Media Row{summary.mediaCreated === 1 ? '' : 's'} Created
        </div>
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          Took {formatDuration(summary.durationMs)}
        </div>
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          {summary.productsPerSecond} Products/sec
        </div>
        <div className="px-3 py-2 bg-white border border-[#E8E0D5] rounded text-[11px] font-medium tracking-widest uppercase text-zinc-600">
          {summary.rowsPerSecond} Rows/sec
        </div>
      </div>

      {/* Failure section */}
      {summary.failureCount > 0 && (
        <div className="border-2 border-red-200 bg-red-50 rounded p-4 space-y-3">
          <h3 className="text-[13px] font-bold tracking-widest uppercase text-red-700">
            Failed ({summary.failureCount})
          </h3>
          <ul className="space-y-2">
            {summary.results
              .filter((result) => !result.success)
              .map((result, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[12px] text-red-700">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <div>
                      <span className="font-bold">{result.name}</span>
                      {result.errorCode && (
                        <span className="ml-2 font-mono text-[11px] text-red-600">
                          [{result.errorCode}]
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-red-600 text-[11px] mt-0.5">
                        {result.error}
                      </div>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Download button */}
      <button
        onClick={() => downloadReport(summary)}
        type="button"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E0D5] rounded text-[12px] font-medium text-zinc-700 hover:bg-[#FAF8F5] transition-colors"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Download Report
      </button>
    </div>
  );
}
