'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FormatGuideProps {
  isExpanded?: boolean;
  onToggle?: () => void;
}

interface ColumnSpec {
  name: string;
  required: string;
  description: string;
}

const COLUMN_SPECS: ColumnSpec[] = [
  {
    name: 'name',
    required: 'Required (every row)',
    description: 'Product name. Repeat the exact same name on every row that belongs to the same product.',
  },
  {
    name: 'category_name',
    required: 'Required (first row only)',
    description: 'Must match an existing category name. Leave blank on repeat rows for the same product.',
  },
  {
    name: 'price',
    required: 'Required (first row only)',
    description: 'Non-negative number, e.g. 45000. Leave blank on repeat rows.',
  },
  {
    name: 'status',
    required: 'Required (first row only)',
    description: 'PUBLISHED or DRAFT. Leave blank on repeat rows.',
  },
  {
    name: 'work_types',
    required: 'Optional (first row only)',
    description: 'Semicolon-separated list, e.g. Zardozi;Kundan. Leave blank on repeat rows.',
  },
  {
    name: 'short_description',
    required: 'Optional (first row only)',
    description: 'Max 300 characters. Leave blank on repeat rows.',
  },
  {
    name: 'description',
    required: 'Optional (first row only)',
    description: 'Long-form description. Leave blank on repeat rows.',
  },
  {
    name: 'color_label',
    required: 'Optional (every row)',
    description: 'Leave blank for a primary/main image row, or set a color name (e.g. Red) to attach this image to a color variant.',
  },
  {
    name: 'image_url',
    required: 'Required (every row)',
    description: 'A single image URL for this row, paired with the color_label on the same row.',
  },
];

/**
 * Collapsible reference card explaining the CSV bulk import format.
 * Mirrors the SEO collapsible card pattern used in ProductForm.
 */
export default function FormatGuide({ isExpanded, onToggle }: FormatGuideProps) {
  const [internalExpanded, setInternalExpanded] = useState(true);

  const expanded = isExpanded ?? internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  return (
    <div className="bg-white border border-[#E8E0D5]">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls="format-guide-content"
        className="w-full px-8 py-5 flex items-center justify-between hover:bg-[#FAF8F5]/30 transition-colors cursor-pointer"
      >
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-700 uppercase text-left">
          CSV Format Guide
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {expanded && (
        <div id="format-guide-content" className="px-8 pb-8 space-y-6 border-t border-[#FAF8F5]">
          <p className="text-[13px] text-zinc-600 leading-relaxed mt-6">
            Each row in the CSV describes one image (and optionally one color) for a product. To
            import a product with multiple colors or images, repeat the row with the same <code className="text-[11px] bg-[#FAF8F5] px-1 py-0.5 rounded">name</code>, leaving the
            product-level fields (category, price, status, work types, descriptions) blank on every
            row after the first.
          </p>

          {/* Column reference table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E0D5]">
                  <th className="py-2 pr-4 text-[9px] font-bold tracking-widest text-zinc-500 uppercase whitespace-nowrap">
                    Column
                  </th>
                  <th className="py-2 pr-4 text-[9px] font-bold tracking-widest text-zinc-500 uppercase whitespace-nowrap">
                    Requirement
                  </th>
                  <th className="py-2 text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_SPECS.map((col) => (
                  <tr key={col.name} className="border-b border-[#FAF8F5]">
                    <td className="py-2 pr-4 align-top">
                      <code className="text-[11px] font-medium text-zinc-800 whitespace-nowrap">
                        {col.name}
                      </code>
                    </td>
                    <td className="py-2 pr-4 align-top text-[11px] text-zinc-500 whitespace-nowrap">
                      {col.required}
                    </td>
                    <td className="py-2 align-top text-[12px] text-zinc-600 leading-relaxed">
                      {col.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Annotated example: single-color product */}
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              Example — Single Image Product (1 row)
            </h4>
            <pre className="bg-[#FAF8F5] border border-[#E8E0D5] rounded px-4 py-3 text-[11px] text-zinc-700 overflow-x-auto whitespace-pre">
{`name,category_name,price,status,work_types,short_description,description,color_label,image_url
Bridal Lehenga A1,Bridal Lehengas,45000,PUBLISHED,Zardozi;Kundan,A stunning bridal lehenga,"Intricate zardozi work...",,https://example.com/lehenga-a1.jpg`}
            </pre>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              One row, everything filled in. <code className="bg-white px-1">color_label</code> is
              blank, so this becomes a primary image.
            </p>
          </div>

          {/* Annotated example: multi-color product */}
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              Example — Multi-Color Product (3 rows)
            </h4>
            <pre className="bg-[#FAF8F5] border border-[#E8E0D5] rounded px-4 py-3 text-[11px] text-zinc-700 overflow-x-auto whitespace-pre">
{`name,category_name,price,status,work_types,short_description,description,color_label,image_url
Evening Gown B1,Evening Gowns,35000,PUBLISHED,Cut;Thread,Elegant evening gown,"Timeless design...",Red,https://example.com/gown-b1-red-front.jpg
Evening Gown B1,,,,,,,,https://example.com/gown-b1-red-back.jpg
Evening Gown B1,,,,,,,Gold,https://example.com/gown-b1-gold-front.jpg`}
            </pre>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Row 1 is the anchor row — it carries category, price, status, and starts the &quot;Red&quot; color. Row 2 repeats the same <code className="bg-white px-1">name</code> but leaves <code className="bg-white px-1">color_label</code> blank, so its image is added as a primary/main image (not attached to Red). Row 3 repeats the name again with <code className="bg-white px-1">color_label</code> set to &quot;Gold&quot;, introducing a second color. To add a second image to the same color, repeat that color&apos;s label on another row.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
