import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

describe('create_order_txn — state-based shipping', () => {
  const testState = 'RPC Test State';
  let testProductId: string;
  let testProductPrice: number;
  const createdOrderIds: string[] = [];
  const createdCustomerEmails: string[] = [];

  beforeAll(async () => {
    // Order by price ascending — an unordered `.limit(1)` can land on any
    // product, and this store's catalog includes items priced well above the
    // ₹5000 free-shipping threshold, which would make the "below threshold"
    // tests below assert on a product that's never actually below it.
    const { data: product, error } = await supabase
      .from('products')
      .select('id, price')
      .order('price', { ascending: true })
      .limit(1)
      .single();
    expect(error).toBeNull();
    testProductId = product!.id;
    testProductPrice = Number(product!.price);

    const { error: rateError } = await supabase
      .from('shipping_rates')
      .insert({ state: testState, charge: 777 });
    expect(rateError).toBeNull();
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      await supabase.from('order_items').delete().eq('order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);
    }
    for (const email of createdCustomerEmails) {
      await supabase.from('customers').delete().eq('email', email);
    }
    await supabase.from('shipping_rates').delete().eq('state', testState);
  }, 15000);

  test('charges the configured state rate when subtotal is below the free-shipping threshold', async () => {
    const email = `rpc-test-${Date.now()}@example.com`;
    createdCustomerEmails.push(email);

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeNull();
    expect(data.already_exists).toBe(false);
    createdOrderIds.push(data.order_id);
    expect(Number(data.total)).toBeCloseTo(testProductPrice + 777, 2);
  });

  test('rejects an unconfigured state without creating an order', async () => {
    const email = `rpc-test-${Date.now()}-2@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: 'Nonexistent State ZZZ', city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_2`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('SHIPPING_STATE_NOT_CONFIGURED');

    // The exception rolls back the whole function invocation (plpgsql functions
    // are atomic per call), so the customer upsert above never persists either.
    const { data: leaked } = await supabase.from('customers').select('id').eq('email', email);
    expect(leaked).toEqual([]);
  });

  test('applies free shipping when subtotal meets the global threshold', async () => {
    const email = `rpc-test-${Date.now()}-3@example.com`;
    createdCustomerEmails.push(email);

    // shipping_settings is seeded with threshold=5000 by the schema migration;
    // request enough quantity to clear it regardless of the seed product's price.
    const qty = Math.ceil(5000 / testProductPrice) + 1;

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: qty }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_3`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeNull();
    createdOrderIds.push(data.order_id);
    expect(Number(data.total)).toBeCloseTo(testProductPrice * qty, 2);
  });

  test('rejects a non-positive quantity without creating an order', async () => {
    const email = `rpc-test-${Date.now()}-4@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: -1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_4`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('INVALID_QUANTITY');

    const { data: leaked } = await supabase.from('customers').select('id').eq('email', email);
    expect(leaked).toEqual([]);
  });

  test('rejects a zero quantity', async () => {
    const email = `rpc-test-${Date.now()}-5@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 0 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_5`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('INVALID_QUANTITY');
  });

  test('rejects a missing/blank state distinctly from an unconfigured state', async () => {
    const email = `rpc-test-${Date.now()}-6@example.com`;

    const { error: missingError } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { city: 'Test City', pincode: '000000' }, // no `state` key at all
      p_payment_id: `rpc_test_${Date.now()}_6`,
      p_payment_provider: 'razorpay',
    });
    expect(missingError).toBeDefined();
    expect(missingError!.message).toContain('SHIPPING_STATE_MISSING');

    const { error: blankError } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: '   ', city: 'Test City', pincode: '000000' }, // blank state
      p_payment_id: `rpc_test_${Date.now()}_6b`,
      p_payment_provider: 'razorpay',
    });
    expect(blankError).toBeDefined();
    expect(blankError!.message).toContain('SHIPPING_STATE_MISSING');
  });

  test('is idempotent under the new shipping-aware code path: replaying the same payment_id returns the original order without recharging', async () => {
    const email = `rpc-test-${Date.now()}-7@example.com`;
    createdCustomerEmails.push(email);
    const paymentId = `rpc_test_${Date.now()}_7`;

    const first = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: paymentId,
      p_payment_provider: 'razorpay',
    });
    expect(first.error).toBeNull();
    createdOrderIds.push(first.data.order_id);

    const second = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: paymentId, // same payment_id — simulates a client retry / double-submit
      p_payment_provider: 'razorpay',
    });
    expect(second.error).toBeNull();
    expect(second.data.already_exists).toBe(true);
    expect(second.data.order_id).toBe(first.data.order_id);
    expect(Number(second.data.total)).toBe(Number(first.data.total));

    // Confirm no duplicate order was actually persisted
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_id', paymentId);
    expect(count).toBe(1);
  });

  test('the anon role cannot call create_order_txn directly (bypassing Razorpay signature verification)', async () => {
    const { error } = await anonSupabase.rpc('create_order_txn', {
      p_customer: { name: 'Anon Probe', email: `anon-probe-${Date.now()}@example.com`, phone: '0000000000', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `anon_probe_${Date.now()}`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/permission denied/i);
  });
});
