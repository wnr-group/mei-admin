'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, X } from 'lucide-react';
import { parseAndValidateFile } from '@/lib/csv-import/parse';
import { groupRowsByProduct } from '@/lib/csv-import/group';
import { validateGroupingResult, isValidFile } from '@/lib/csv-import/validate';
import { downloadTemplate } from '@/lib/csv-import/template';
import { WORK_TYPES, PRODUCT_STATUSES } from '@/lib/csv-import/constants';
import type { GroupingResult, ValidationContext } from '@/lib/csv-import/types';
import FormatGuide from './FormatGuide';
import ImportDropzone from './ImportDropzone';
import PreviewTree from './PreviewTree';

interface ImportPageClientProps {
  categories: Array<{ id: string; name: string }>;
}

type ParseStatus = 'idle' | 'loading' | 'success' | 'error';

const TOAST_MESSAGE =
  'Bulk import preview completed successfully. Database import will be implemented in a future ticket.';

const TOAST_AUTO_DISMISS_MS = 6000;

/**
 * Orchestrates the bulk product CSV import preview flow: file upload,
 * client-side parse/group/validate pipeline, and the grouped preview tree.
 *
 * This is preview-only — the Import button never writes to the database or
 * calls an Edge Function. It only surfaces a confirmation toast.
 */
export default function ImportPageClient({ categories }: ImportPageClientProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const validationContext: ValidationContext = useMemo(
    () => ({
      categories,
      allowedWorkTypes: [...WORK_TYPES],
      allowedStatuses: [...PRODUCT_STATUSES],
    }),
    [categories]
  );

  // Auto-dismiss the confirmation toast.
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setStatus('loading');
    setFileError(undefined);
    setGroupingResult(null);

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

  const isImportEnabled = status === 'success' && groupingResult !== null && isValidFile(groupingResult);

  const handleImportClick = () => {
    if (!isImportEnabled) return;
    setToastMessage(TOAST_MESSAGE);
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
      {status === 'success' && groupingResult && (
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
            Preview
          </h3>
          <PreviewTree groups={groupingResult.groups} unassignedRows={groupingResult.unassignedRows} />
        </div>
      )}

      {/* Footer bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E8E0D5] px-8 py-4 flex items-center justify-between z-40">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
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
            Import
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-6 z-50 flex items-start gap-3 bg-[#1A1A1A] text-[#FAF8F5] text-[12px] leading-relaxed px-5 py-4 max-w-sm shadow-lg animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-[#8BC98F] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="grow">{toastMessage}</p>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="shrink-0 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
