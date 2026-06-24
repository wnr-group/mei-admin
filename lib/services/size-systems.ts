import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface SizeSystem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface SizeSystemEntry {
  id: string;
  system_id: string;
  label: string;
  sort_order: number;
  bust_cm?: number;
  waist_cm?: number;
  hip_cm?: number;
  created_at: string;
}

export async function getSizeSystems(): Promise<SizeSystem[]> {
  const { data, error } = await supabase
    .from('size_systems')
    .select('id, name, description, created_at')
    .is('deleted_at', null)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getSizeSystemEntries(systemId: string): Promise<SizeSystemEntry[]> {
  const { data, error } = await supabase
    .from('size_system_entries')
    .select('*')
    .eq('system_id', systemId)
    .is('deleted_at', null)
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

export async function getSizeChart(systemId: string): Promise<SizeSystemEntry[]> {
  return getSizeSystemEntries(systemId);
}
