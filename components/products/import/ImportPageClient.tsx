'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, X } from 'lucide-react';
import { parseAndValidateFile } from '@/lib/csv-import/parse';
import { groupRowsByProduct } from '@/lib/csv-import/group';
import { validateGroupingResult, isValidFile } from '@/lib/csv-import/validate';
import { downloadTemplate } from '@/lib/csv-import/template';
import { WORK_TYPES, PRODUCT_STATUSES } from '@/lib/csv-import/constants';
import {
  bulkImportProducts,
  findExistingProductNames,
  type BulkImportSummary,
  type ImportStage,
} from '@/services/product-import';
import type { GroupingResult, ValidationContext } from '@/lib/csv-import/types';
// ssr: false prevents the hydration mismatch caused by React's SSR whitespace
// normalisation around inline <code> elements differing from client rendering.
const FormatGuide = dynamic(() => import('./FormatGuide'), { ssr: false });
import ImportDropzone from './ImportDropzone';
import PreviewTree from './PreviewTree';
import ImportResultSummary from './ImportResultSummary';

interface ImportPageClientProps {
  categories: Array<{ id: string; name: string }>;
}

type ParseStatus = 'idle' | 'loading' | 'success' | 'error';
type ImportStatus = 'idle' | 'importing' | 'done';

const TOAST_AUTO_DISMISS_MS = 6000;

const STAGE_LABELS: Record<ImportStage, string> = {
  RESOLVING_CATEGORIES: 'Resolving categories…',
  GENERATING_IDENTIFIERS: 'Generating slugs and product codes…',
  CREATING_PRODUCTS: 'Creating products…',
  CREATING_COLORS_AND_MEDIA: 'Creating colors and media…',
  LOGGING_AUDIT: 'Recording audit log…',
  COMPLETED: 'Finishing up…',
};

/**
 * Orchestrates the bulk product CSV import flow: file upload, client-side
 * parse/group/validate pipeline, grouped preview tree, and the database
 * batch-import step (products, colors, media, audit log).
 */
export default function ImportPageClient({ categories }: ImportPageClientProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importStage, setImportStage] = useState<ImportStage | null>(null);
  const [importSummary, setImportSummary] = useState<BulkImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight import if this page unmounts (e.g. the admin
  // navigates away via client-side routing while an import is running) —
  // see "AbortController Support" in the Production Readiness Review.
  // Already-committed writes are not rolled back by this; it only stops
  // outstanding requests and prevents a setState call after unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const validationContext: ValidationContext = useMemo(
    () => ({
      categories,
      allowedWorkTypes: [...WORK_TYPES],
      allowedStatuses: [...PRODUCT_STATUSES],
    }),
    [categories]
  );

  // Auto-dismiss the import-error toast.
  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [importError]);

  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setStatus('loading');
    setFileError(undefined);
    setGroupingResult(null);
    setImportStatus('idle');
    setImportSummary(null);

    const reader = new FileReader();

    reader.onload = () => {
      const csvText = typeof reader.result === 'string' ? reader.result : '';

      try {
        const { fileError: parseFileError, rows } = parseAndValidateFile(csvText);

        if (parseFileError || !rows) {
          setFileError(parseFileError?.message ?? 'An error occurred while reading this file.');
          setStatus('error');
          return;
        }

        const grouped = groupRowsByProduct(rows);
        const validated = validateGroupingResult(grouped, validationContext);
        setGroupingResult(validated);
        setStatus('success');
      } catch {
        setFileError('An error occurred while parsing this file. Please check the format and try again.');
        setStatus('error');
      }
    };

    reader.onerror = () => {
      setFileError('Failed to read the selected file. Please try again.');
      setStatus('error');
    };

    reader.readAsText(file);
  };

  const isImportEnabled =
    status === 'success' && groupingResult !== null && isValidFile(groupingResult) && importStatus === 'idle';

  const handleImportClick = async () => {
    if (!isImportEnabled || !groupingResult) return;

    // Idempotency safeguard: warn (rather than silently re-create) if any of
    // these product names already exist — the most common accidental-repeat
    // scenario is re-uploading the same file twice. This is a name-based
    // check rather than a CSV checksum/import-session table, since no
    // import-history schema exists and adding one is out of scope here.
    const names = groupingResult.groups.map((g) => g.name);
    const existingNames = await findExistingProductNames(names);
    if (existingNames.length > 0) {
      const proceed = window.confirm(
        `${existingNames.length} product name(s) already exist in your catalog:\n${existingNames.join(', ')}\n\nContinue importing anyway?`
      );
      if (!proceed) return;
    }

    setImportStatus('importing');
    setImportStage(null);
    setImportError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const summary = await bulkImportProducts(groupingResult.groups, categories, {
        filename: fileName ?? undefined,
        onProgress: setImportStage,
        signal: controller.signal,
      });
      // The component may have unmounted (or a new import may have started)
      // while this awaited — skip state updates on an aborted/stale attempt.
      if (controller.signal.aborted) return;
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setImportSummary(summary);
      setImportStatus('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      setImportError(err instanceof Error ? err.message : 'Bulk import failed. Please try again.');
      setImportStatus('idle');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-28 font-inter animate-fade-in px-4">
      {/* Breadcrumb */}
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none">
        <Link href="/products" className="hover:text-zinc-600 transition-colors">
          Products
        </Link>
        <span className="mx-2 text-[#B38B5D] font-bold">/</span>
        <span className="text-zinc-800">Bulk Import</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-[24px] text-zinc-950 font-normal tracking-wide">
          Bulk Product Import
        </h1>

        <button
          type="button"
          onClick={() => downloadTemplate()}
          className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
          Download CSV Template
        </button>
      </div>

      {/* Format Guide */}
      <FormatGuide />

      {/* Upload card */}
      <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
          Upload CSV File
        </h3>
        <ImportDropzone
          onFileSelected={handleFileSelected}
          isLoading={status === 'loading'}
          error={fileError}
        />
        {fileName && status !== 'error' && (
          <p className="text-[11px] text-zinc-500">
            Selected file: <span className="font-medium text-zinc-700">{fileName}</span>
          </p>
        )}
      </div>

      {/* Preview section */}
      {status === 'success' && groupingResult && importStatus !== 'done' && (
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
            Preview
          </h3>
          <PreviewTree groups={groupingResult.groups} unassignedRows={groupingResult.unassignedRows} />
        </div>
      )}

      {/* Import results */}
      {importStatus === 'done' && importSummary && (
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
            Import Results
          </h3>
          <ImportResultSummary summary={importSummary} />
        </div>
      )}

      {/* Footer bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E8E0D5] px-8 py-4 flex items-center justify-between z-40">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
          {importStatus === 'done' ? (
            <>
              <span />
              <Link
                href="/products"
                aria-label="Return to the products list"
                className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest px-8 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer"
              >
                Back to Products
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/products"
                aria-label="Cancel bulk import and return to products list"
                className="text-[11px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase py-2 cursor-pointer select-none"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={handleImportClick}
                disabled={!isImportEnabled}
                aria-disabled={!isImportEnabled}
                aria-label="Import products from the previewed CSV file"
                className={`text-[11px] font-bold tracking-widest px-8 py-3.5 transition-colors duration-200 rounded-none uppercase flex items-center gap-2 ${
                  isImportEnabled
                    ? 'bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] cursor-pointer'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {importStatus === 'importing' ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Importing overlay */}
      {importStatus === 'importing' && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">
            {importStage ? STAGE_LABELS[importStage] : 'Importing products…'}
          </div>
        </div>
      )}

      {/* Error toast */}
      {importError && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-6 z-50 flex items-start gap-3 bg-red-600 text-white text-[12px] leading-relaxed px-5 py-4 max-w-sm shadow-lg animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="grow">{importError}</p>
          <button
            type="button"
            onClick={() => setImportError(null)}
            aria-label="Dismiss notification"
            className="shrink-0 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
