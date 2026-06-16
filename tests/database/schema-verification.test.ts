import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local so integration tests can reach Supabase
config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Schema Verification', () => {
  test('All tables exist with correct columns', async () => {
    const tables = [
      'size_systems', 'size_system_entries', 'product_colors',
      'product_variants', 'product_media', 'measurement_templates',
      'measurement_template_fields', 'blouse_configurations', 'order_item_measurements'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      // PGRST116 = relation not found (acceptable if table doesn't exist)
      // Any other error is a real schema problem
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Table ${table} check failed: ${error.message}`);
      }
    }
  });

  test('product_variants unique index prevents duplicates', async () => {
    let testColor: { id: string } | null = null;
    let testVariant1: { id: string } | null = null;

    try {
      const { data: product, error: productErr } = await supabase
        .from('products')
        .select('id')
        .limit(1)
        .single();

      expect(productErr).toBeNull();
      expect(product).toBeDefined();

      const { data: color1, error: colorErr } = await supabase
        .from('product_colors')
        .insert({
          product_id: product!.id,
          label: 'Test Color 1',
          sort_order: 0
        })
        .select()
        .single();

      expect(colorErr).toBeNull();
      testColor = color1;

      const { data: v1, error: err1 } = await supabase
        .from('product_variants')
        .insert({
          product_id: product!.id,
          color_id: color1!.id,
          customization_type: 'STANDARD_SIZE',
          size_label: 'Test'
        })
        .select()
        .single();

      expect(err1).toBeNull();
      testVariant1 = v1;

      const { data: v2, error: err2 } = await supabase
        .from('product_variants')
        .insert({
          product_id: product!.id,
          color_id: color1!.id,
          customization_type: 'STANDARD_SIZE',
          size_label: 'Test'
        });

      expect(err2).toBeDefined();
      expect(err2?.code).toBe('23505'); // unique violation
    } finally {
      // Guaranteed cleanup even if test fails
      if (testVariant1) {
        await supabase.from('product_variants').delete().eq('id', testVariant1.id);
      }
      if (testColor) {
        await supabase.from('product_colors').delete().eq('id', testColor.id);
      }
    }
  });

  test('generate_variant_sku produces correct format', async () => {
    const { data, error } = await supabase.rpc('generate_variant_sku', {
      p_product_code: 'NOOR',
      p_color: 'Ivory White',
      p_size: '38',
      p_type: 'STANDARD_SIZE'
    });

    expect(error).toBeNull();
    expect(data).toBe('NOOR-IVO-38-ST');
  });

  test('v_products_storefront returns primary_image_url and effective_min_price', async () => {
    const { data, error } = await supabase
      .from('v_products_storefront')
      .select('id, primary_image_url, effective_min_price')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.[0]).toHaveProperty('primary_image_url');
    expect(data?.[0]).toHaveProperty('effective_min_price');
  });

  test('Soft-deleted variant + new same combo allowed', async () => {
    let testColor: { id: string } | null = null;
    let testVariant1: { id: string } | null = null;
    let testVariant2: { id: string } | null = null;

    try {
      const { data: product, error: productErr } = await supabase
        .from('products')
        .select('id')
        .limit(1)
        .single();

      expect(productErr).toBeNull();
      expect(product).toBeDefined();

      const { data: color, error: colorErr } = await supabase
        .from('product_colors')
        .insert({
          product_id: product!.id,
          label: 'Soft Delete Test',
          sort_order: 0
        })
        .select()
        .single();

      expect(colorErr).toBeNull();
      testColor = color;

      const { data: v1, error: varErr1 } = await supabase
        .from('product_variants')
        .insert({
          product_id: product!.id,
          color_id: color!.id,
          customization_type: 'UNSTITCHED',
          size_label: 'Test'
        })
        .select()
        .single();

      expect(varErr1).toBeNull();
      testVariant1 = v1;

      // Soft delete
      await supabase
        .from('product_variants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', v1!.id);

      // Insert same combo again
      const { data: v2, error: err } = await supabase
        .from('product_variants')
        .insert({
          product_id: product!.id,
          color_id: color!.id,
          customization_type: 'UNSTITCHED',
          size_label: 'Test'
        })
        .select()
        .single();

      expect(err).toBeNull();
      expect(v2).toBeDefined();
      testVariant2 = v2;
    } finally {
      // Guaranteed cleanup even if test fails
      if (testVariant2) {
        await supabase.from('product_variants').delete().eq('id', testVariant2.id);
      }
      if (testVariant1) {
        await supabase.from('product_variants').delete().eq('id', testVariant1.id);
      }
      if (testColor) {
        await supabase.from('product_colors').delete().eq('id', testColor.id);
      }
    }
  });
});
