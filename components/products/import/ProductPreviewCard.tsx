'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, XCircle } from 'lucide-react';
import type { ProductGroup } from '@/lib/csv-import/types';

interface ProductPreviewCardProps {
  group: ProductGroup;
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `₹${price.toLocaleString('en-IN')}`;
}

/**
 * Expandable card previewing one grouped product from the CSV import,
 * including its colors, primary images, and any validation errors.
 */
export default function ProductPreviewCard({ group }: ProductPreviewCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasErrors = group.errors.length > 0;
  const contentId = `product-preview-${group.originalRowIndex}`;

  return (
    <div className={`border rounded ${hasErrors ? 'border-red-200' : 'border-[#E8E0D5]'} bg-white`}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full px-4 py-3 flex items-center gap-2 flex-wrap text-left hover:bg-[#FAF8F5]/40 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
        )}

        <span className="text-[13px] font-medium text-zinc-800">
          Product: {group.name}
        </span>

        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {group.categoryName?.trim() || 'No category'}
        </span>

        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {formatPrice(group.price)}
        </span>

        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5 uppercase">
          {group.status ?? (group.rawStatus || 'unknown')}
        </span>

        {hasErrors && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {group.errors.length} error{group.errors.length === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {expanded && (
        <div id={contentId} className="px-4 pb-4 space-y-4 border-t border-[#FAF8F5] pt-3">
          {hasErrors && (
            <div className="space-y-1">
              <h4 className="text-[9px] font-bold tracking-widest text-red-600 uppercase">
                Errors
              </h4>
              <ul className="space-y-1">
                {group.errors.map((err, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[12px] text-red-700">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      <code className="font-medium">{err.field}</code>: {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {group.colors.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                Colors
              </h4>
              <ul className="space-y-2">
                {group.colors.map((color, idx) => (
                  <li key={idx} className="text-[12px] text-zinc-700">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-400 font-mono">└─</span>
                      <span>Color: {color.label}</span>
                    </div>
                    <ul className="pl-8 space-y-0.5">
                      {color.imageUrls.map((url, imgIdx) => (
                        <li key={imgIdx} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="text-zinc-300 font-mono">└─</span>
                          <span className="truncate">image: {url}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {group.primaryImages.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                Primary Images
              </h4>
              <ul className="space-y-0.5">
                {group.primaryImages.map((image, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="text-zinc-300 font-mono">└─</span>
                    <span className="truncate">image: {image.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {group.colors.length === 0 && group.primaryImages.length === 0 && !hasErrors && (
            <p className="text-[11px] text-zinc-400">No images found for this product.</p>
          )}
        </div>
      )}
    </div>
  );
}
