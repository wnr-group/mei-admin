import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { product_id, category_id, customization_type } = await req.json();

    let template = null;

    if (product_id && customization_type) {
      const { data } = await supabase
        .from('measurement_templates')
        .select('id, version')
        .eq('product_id', product_id)
        .eq('customization_type', customization_type)
        .eq('is_active', true)
        .single();
      if (data) template = data;
    }

    if (!template && product_id) {
      const { data } = await supabase
        .from('measurement_templates')
        .select('id, version')
        .eq('product_id', product_id)
        .is('customization_type', null)
        .eq('is_active', true)
        .single();
      if (data) template = data;
    }

    if (!template && category_id && customization_type) {
      const { data } = await supabase
        .from('measurement_templates')
        .select('id, version')
        .eq('category_id', category_id)
        .eq('customization_type', customization_type)
        .eq('is_active', true)
        .single();
      if (data) template = data;
    }

    if (!template && category_id) {
      const { data } = await supabase
        .from('measurement_templates')
        .select('id, version')
        .eq('category_id', category_id)
        .is('customization_type', null)
        .eq('is_active', true)
        .single();
      if (data) template = data;
    }

    if (!template) {
      const { data } = await supabase
        .from('measurement_templates')
        .select('id, version')
        .is('product_id', null)
        .is('category_id', null)
        .is('customization_type', null)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .single();
      if (data) template = data;
    }

    return new Response(JSON.stringify({ template }), {
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
