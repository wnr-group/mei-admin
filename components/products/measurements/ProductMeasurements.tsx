'use client'

import { useQuery } from '@tanstack/react-query'
import { createUntypedClient } from '@/lib/supabase/client'
import {
  useProductOverride,
  useCreateOverride,
  useDeleteOverride,
} from '@/lib/hooks/useMeasurementTemplates'
import { Skeleton } from '@/components/ui/skeleton'
import MeasurementFieldsTable from './MeasurementFieldsTable'

interface Props {
  productId: string
  categoryId: string | null
}

interface CategoryTemplateInfo {
  templateId: string | null
  templateName: string | null
  categoryName: string | null
}

async function fetchCategoryTemplate(categoryId: string): Promise<CategoryTemplateInfo> {
  const supabase = createUntypedClient()
  const { data: cat } = await supabase
    .from('categories')
    .select('name, measurement_template_id')
    .eq('id', categoryId)
    .maybeSingle()
  let templateName: string | null = null
  if (cat?.measurement_template_id) {
    const { data: tpl } = await supabase
      .from('measurement_templates')
      .select('name')
      .eq('id', cat.measurement_template_id)
      .maybeSingle()
    templateName = tpl?.name ?? null
  }
  return {
    templateId: cat?.measurement_template_id ?? null,
    templateName,
    categoryName: cat?.name ?? null,
  }
}

// The template the product inherits from its primary category (if any).
function useCategoryTemplate(categoryId: string | null) {
  return useQuery({
    queryKey: ['category_template', categoryId],
    queryFn: () => fetchCategoryTemplate(categoryId!),
    enabled: !!categoryId,
  })
}

export default function ProductMeasurements({ productId, categoryId }: Props) {
  const override = useProductOverride(productId)
  const categoryQuery = useCategoryTemplate(categoryId)
  const createOverride = useCreateOverride(productId)
  const deleteOverride = useDeleteOverride(productId)

  const category: CategoryTemplateInfo = categoryQuery.data ?? {
    templateId: null,
    templateName: null,
    categoryName: null,
  }

  if (override.isLoading || (!!categoryId && categoryQuery.isLoading)) {
    return <Skeleton className="h-24 w-full" />
  }

  // Overriding: editable copy of fields, with a revert button.
  if (override.data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-zinc-700 font-medium">
            This product overrides its category template with its own measurements.
          </p>
          <button
            type="button"
            onClick={() => deleteOverride.mutate(override.data!.id)}
            disabled={deleteOverride.isPending}
            className="text-[10px] font-bold tracking-widest text-red-500 hover:text-red-700 uppercase disabled:opacity-50"
          >
            {deleteOverride.isPending ? 'Reverting…' : 'Revert to category'}
          </button>
        </div>
        <MeasurementFieldsTable templateId={override.data.id} />
      </div>
    )
  }

  // Inheriting: show the inherited fields read-only + an Override button.
  const canSeed = !!category.templateId
  return (
    <div className="space-y-4">
      {category.templateId ? (
        <>
          <div className="bg-[#FAF8F5] border border-[#E8E0D5] px-4 py-3">
            <p className="text-[11px] text-zinc-600">
              Inherited from category{' '}
              <span className="font-semibold text-zinc-800">{category.categoryName}</span>
              {category.templateName ? (
                <>
                  {' '}· template{' '}
                  <span className="font-semibold text-zinc-800">{category.templateName}</span>
                </>
              ) : null}
            </p>
          </div>
          <MeasurementFieldsTable templateId={category.templateId} readOnly />
        </>
      ) : (
        <p className="text-[12px] text-zinc-500 font-medium">
          {categoryId
            ? 'This product’s category has no measurement template assigned.'
            : 'Select a category to inherit its measurement template.'}
        </p>
      )}

      <button
        type="button"
        onClick={() => createOverride.mutate(canSeed ? category.templateId : null)}
        disabled={createOverride.isPending}
        className="text-[10px] font-bold tracking-widest text-[#B38B5D] border border-[#B38B5D] px-4 py-2 hover:bg-[#FAF8F5] uppercase disabled:opacity-50"
      >
        {createOverride.isPending
          ? 'Setting up…'
          : canSeed
            ? 'Override for this product'
            : 'Add product-specific measurements'}
      </button>
    </div>
  )
}
