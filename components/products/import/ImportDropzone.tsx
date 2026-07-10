'use client';

import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface ImportDropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
  error?: string;
}

const FILE_INPUT_ID = 'csv-import-file-input';

/**
 * Drag-and-drop CSV uploader. Click (or press Enter/Space) to open the
 * native file picker; drag a .csv file over the zone for visual feedback.
 */
export default function ImportDropzone({ onFileSelected, isLoading, error }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    if (isLoading) return;
    inputRef.current?.click();
  };

  const isCsvFile = (file: File) =>
    file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && isCsvFile(file)) {
      onFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isCsvFile(file)) {
      onFileSelected(file);
    }
    // Reset value so selecting the same file again still fires onChange
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileInput();
    }
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={isLoading ? -1 : 0}
        aria-disabled={isLoading}
        aria-label="Upload CSV file — click or drag and drop"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        onKeyDown={handleKeyDown}
        className={`border border-dashed rounded p-8 text-center transition-colors duration-200 flex flex-col items-center justify-center min-h-[180px] bg-[#FAF8F5]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a465] ${
          isLoading
            ? 'cursor-not-allowed opacity-60 border-[#E8E0D5]'
            : isDragging
              ? 'cursor-pointer border-[#B38B5D] bg-[#FAF8F5]/50'
              : 'cursor-pointer border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          id={FILE_INPUT_ID}
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={isLoading}
          className="hidden"
        />

        {isLoading ? (
          <>
            <Loader2 className="w-6 h-6 stroke-[1.5] text-[#B38B5D] mb-2 animate-spin" />
            <p className="text-[12px] text-zinc-500 font-medium">Processing file&hellip;</p>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 stroke-[1.5] text-zinc-400 mb-2" />
            <p className="text-[12px] text-zinc-500 font-medium">
              Click or drag a CSV file here
            </p>
            <p className="text-[10px] text-zinc-400 mt-1">.csv files only</p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
