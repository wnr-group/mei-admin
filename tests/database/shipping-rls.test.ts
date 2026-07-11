import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Unauthenticated anon client — exactly what the storefront and any other
// internet caller present. No admin session, no JWT.
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

describe('shipping_rates / shipping_settings — RLS', () => {
  test('anon can read shipping_rates', async () => {
    const { data, error } = await anonClient.from('shipping_rates').select('state, charge').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('anon cannot insert into shipping_rates', async () => {
    const { error } = await anonClient
      .from('shipping_rates')
      .insert({ state: 'RLS Probe State', charge: 1 });
    expect(error).toBeDefined();
  });

  test('anon cannot update shipping_rates', async () => {
    const { error } = await anonClient
      .from('shipping_rates')
      .update({ charge: 999 })
      .eq('state', 'Tamil Nadu');
    // PostgREST returns no rows affected (not a hard error) when RLS silently
    // filters the target row — assert the value was NOT actually changed,
    // which is the behaviour that actually matters.
    expect(error).toBeNull();
    const { data } = await serviceClient.from('shipping_rates').select('charge').eq('state', 'Tamil Nadu').single();
    expect(Number(data!.charge)).not.toBe(999);
  });

  test('anon cannot delete from shipping_rates', async () => {
    await anonClient.from('shipping_rates').delete().eq('state', 'Tamil Nadu');
    const { data } = await serviceClient.from('shipping_rates').select('state').eq('state', 'Tamil Nadu').single();
    expect(data).not.toBeNull();
  });

  test('anon can read shipping_settings', async () => {
    const { data, error } = await anonClient.from('shipping_settings').select('*').eq('id', 1).single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  test('anon cannot update shipping_settings', async () => {
    await anonClient.from('shipping_settings').update({ free_shipping_enabled: false }).eq('id', 1);
    const { data } = await serviceClient.from('shipping_settings').select('free_shipping_enabled').eq('id', 1).single();
    // Untouched — still whatever the seed/prior tests left it as true by default
    expect(data!.free_shipping_enabled).toBe(true);
  });

  test('anon cannot delete the shipping_settings singleton row', async () => {
    await anonClient.from('shipping_settings').delete().eq('id', 1);
    const { data } = await serviceClient.from('shipping_settings').select('id').eq('id', 1).single();
    expect(data).not.toBeNull();
  });
});

describe('shipping_rates — CHECK constraint boundaries', () => {
  const probeState = 'CHECK Boundary Probe State';

  afterEach(async () => {
    await serviceClient.from('shipping_rates').delete().eq('state', probeState);
  });

  test('rejects a negative charge', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: -1 });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/check constraint|violates/i);
  });

  test('rejects a charge above the 100000 sanity ceiling', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 100001 });
    expect(error).toBeDefined();
  });

  test('accepts a charge of exactly 0 (a legitimately free state)', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 0 });
    expect(error).toBeNull();
  });

  test('accepts a charge of exactly 100000 (the ceiling is inclusive)', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 100000 });
    expect(error).toBeNull();
  });
});

describe('shipping_settings — CHECK constraint boundaries', () => {
  let originalThreshold: number | null;

  beforeAll(async () => {
    const { data } = await serviceClient.from('shipping_settings').select('free_shipping_threshold').eq('id', 1).single();
    originalThreshold = data!.free_shipping_threshold;
  });

  afterAll(async () => {
    await serviceClient.from('shipping_settings').update({ free_shipping_threshold: originalThreshold }).eq('id', 1);
  });

  test('rejects a negative free_shipping_threshold', async () => {
    const { error } = await serviceClient.from('shipping_settings').update({ free_shipping_threshold: -1 }).eq('id', 1);
    expect(error).toBeDefined();
  });

  test('accepts a null free_shipping_threshold (rule present but unset)', async () => {
    const { error } = await serviceClient.from('shipping_settings').update({ free_shipping_threshold: null }).eq('id', 1);
    expect(error).toBeNull();
  });
});
