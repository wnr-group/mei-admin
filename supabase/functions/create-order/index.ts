import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface CreateOrderRequest {
  user_id: string;
  items: Array<{
    variant_id: string;
    quantity: number;
    measurements?: Record<string, number>;
  }>;
  shipping_address: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json() as CreateOrderRequest;

    // Start transaction
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: body.user_id,
        total_amount: 0,
        order_status: 'PENDING',
        shipping_address: body.shipping_address
      })
      .select()
      .single();

    if (orderError) throw orderError;

    let totalAmount = 0;

    for (const item of body.items) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('id, product_id, price_override, stock_quantity, allow_backorder, track_inventory')
        .eq('id', item.variant_id)
        .single();

      if (!variant) throw new Error(`Variant ${item.variant_id} not found`);

      if (variant.track_inventory && variant.stock_quantity < item.quantity && !variant.allow_backorder) {
        throw new Error(`Insufficient stock for variant ${item.variant_id}`);
      }

      const { data: product } = await supabase
        .from('products')
        .select('id, name, category, price')
        .eq('id', variant.product_id)
        .single();

      const effectivePrice = variant.price_override ?? product.price;
      const itemTotal = effectivePrice * item.quantity;
      totalAmount += itemTotal;

      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: effectivePrice,
          product_snapshot: {
            id: product.id,
            name: product.name,
            category: product.category,
            base_price: product.price
          },
          variant_snapshot: {
            variant_name: 'Variant',
            price: effectivePrice
          }
        })
        .select()
        .single();

      if (itemError) throw itemError;

      if (item.measurements) {
        const measurementRows = Object.entries(item.measurements).map(([key, value]) => ({
          order_item_id: orderItem.id,
          field_key: key,
          value_cm: value,
          recorded_at: new Date().toISOString()
        }));

        const { error: measError } = await supabase
          .from('order_item_measurements')
          .insert(measurementRows);

        if (measError) throw measError;
      }

      if (variant.track_inventory) {
        const { error: stockError } = await supabase
          .from('product_variants')
          .update({ stock_quantity: Math.max(0, variant.stock_quantity - item.quantity) })
          .eq('id', item.variant_id);

        if (stockError) throw stockError;
      }
    }

    await supabase
      .from('orders')
      .update({ total_amount: totalAmount })
      .eq('id', order.id);

    return new Response(JSON.stringify({ order_id: order.id, total_amount: totalAmount }), {
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
