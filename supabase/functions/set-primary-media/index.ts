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
    const { media_id, product_id, color_id } = await req.json();

    if (color_id) {
      await supabase
        .from('product_media')
        .update({ is_primary: false })
        .eq('product_id', product_id)
        .eq('color_id', color_id)
        .neq('id', media_id);
    } else {
      await supabase
        .from('product_media')
        .update({ is_primary: false })
        .eq('product_id', product_id)
        .is('color_id', null)
        .neq('id', media_id);
    }

    const { error } = await supabase
      .from('product_media')
      .update({ is_primary: true })
      .eq('id', media_id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
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
