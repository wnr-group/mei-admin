import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface BulkVariantInput {
  product_id: string;
  color_id?: string;
  size_entry_id?: string;
  customization_type: string;
  price_override?: number;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json() as { variants: BulkVariantInput[] };

    const results = [];

    for (const v of body.variants) {
      const { data: product } = await supabase
        .from('products')
        .select('product_code')
        .eq('id', v.product_id)
        .single();

      if (!product) throw new Error(`Product ${v.product_id} not found`);

      let colorLabel: string | null = null;
      if (v.color_id) {
        const { data: color } = await supabase
          .from('product_colors')
          .select('label')
          .eq('id', v.color_id)
          .single();
        colorLabel = color?.label;
      }

      const { data: skuData } = await supabase.rpc('generate_variant_sku', {
        p_product_code: product.product_code,
        p_color: colorLabel,
        p_size: v.size_entry_id ? 'STD' : null,
        p_type: v.customization_type
      });

      const { data: variant, error: insertError } = await supabase
        .from('product_variants')
        .insert({
          product_id: v.product_id,
          color_id: v.color_id,
          size_entry_id: v.size_entry_id,
          customization_type: v.customization_type,
          sku: skuData,
          price_override: v.price_override,
          is_available: true
        })
        .select()
        .single();

      if (insertError) {
        results.push({ success: false, error: insertError.message });
      } else {
        results.push({ success: true, variant_id: variant.id, sku: variant.sku });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
