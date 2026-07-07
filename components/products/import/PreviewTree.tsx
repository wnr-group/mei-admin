'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { ProductGroup, UnassignedRow } from '@/lib/csv-import/types';
import ProductPreviewCard from './ProductPreviewCard';

interface PreviewTreeProps {
  groups: ProductGroup[];
  unassignedRows: UnassignedRow[];
  isLoading?: boolean;
}

/**
 * Renders the parsed/validated preview of a CSV import: one expandable
 * card per grouped product, an unassigned-rows section, and a summary line.
 */
export default function PreviewTree({ groups, unassignedRows, isLoading }: PreviewTreeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[12px] text-zinc-400 animate-pulse">Building preview&hellip;</p>
      </div>
    );
  }

  const errorCount = groups.filter((g) => g.errors.length > 0).length;

  if (groups.length === 0 && unassignedRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[12px] text-zinc-400">No products to preview yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-medium text-zinc-600">
        {groups.length} product{groups.length === 1 ? '' : 's'}, {errorCount} with error
        {errorCount === 1 ? '' : 's'}
      </p>

      <div className="space-y-3">
        {groups.map((group) => (
          <ProductPreviewCard key={`${group.name}-${group.originalRowIndex}`} group={group} />
        ))}
      </div>

      {unassignedRows.length > 0 && (
        <div className="border border-red-200 rounded bg-red-50/40 p-4 space-y-2">
          <h4 className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-red-600 uppercase">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Unassigned Rows ({unassignedRows.length})
          </h4>
          <ul className="space-y-1">
            {unassignedRows.map((row) => (
              <li key={row.rowIndex} className="text-[12px] text-red-700">
                Row {row.rowIndex}: {row.error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
