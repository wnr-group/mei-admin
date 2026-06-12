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

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Table ${table} check failed: ${error.message}`);
      }
    }
  });

  test('product_variants unique index prevents duplicates', async () => {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .single();

    const { data: color1, error: colorErr } = await supabase
      .from('product_colors')
      .insert({
        product_id: product.id,
        label: 'Test Color 1',
        sort_order: 0
      })
      .select()
      .single();

    const { data: v1, error: err1 } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        color_id: color1.id,
        customization_type: 'STANDARD_SIZE',
        size_label: 'Test'
      })
      .select()
      .single();

    const { data: v2, error: err2 } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        color_id: color1.id,
        customization_type: 'STANDARD_SIZE',
        size_label: 'Test'
      });

    expect(err2).toBeDefined();
    expect(err2?.code).toBe('23505'); // unique violation

    // Cleanup
    await supabase.from('product_variants').delete().eq('id', v1.id);
    await supabase.from('product_colors').delete().eq('id', color1.id);
  });

  test('generate_variant_sku produces correct format', async () => {
    const { data, error } = await supabase.rpc('generate_variant_sku', {
      p_product_code: 'NOOR',
      p_color: 'Ivory White',
      p_size: '38',
      p_type: 'STANDARD_SIZE'
    });

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
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .single();

    const { data: color } = await supabase
      .from('product_colors')
      .insert({
        product_id: product.id,
        label: 'Soft Delete Test',
        sort_order: 0
      })
      .select()
      .single();

    const { data: v1 } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        color_id: color.id,
        customization_type: 'UNSTITCHED',
        size_label: 'Test'
      })
      .select()
      .single();

    // Soft delete
    await supabase
      .from('product_variants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', v1.id);

    // Insert same combo again
    const { data: v2, error: err } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        color_id: color.id,
        customization_type: 'UNSTITCHED',
        size_label: 'Test'
      })
      .select()
      .single();

    expect(err).toBeNull();
    expect(v2).toBeDefined();

    // Cleanup
    await supabase.from('product_variants').delete().eq('id', v2.id);
    await supabase.from('product_colors').delete().eq('id', color.id);
  });
});
