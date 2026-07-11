import { createUntypedClient } from '@/lib/supabase/client';

export type CustomizationType =
  | 'UNSTITCHED'
  | 'SEMI_STITCHED'
  | 'STANDARD_SIZE'
  | 'CUSTOM_TAILORED';
export type MeasurementFieldKey =
  | 'bust'
  | 'upper_bust'
  | 'under_bust'
  | 'waist'
  | 'hip'
  | 'shoulder'
  | 'blouse_length'
  | 'sleeve_length'
  | 'lehenga_length'
  | 'bottom_length'
  | 'dupatta_length'
  | 'torso_length'
  | 'back_length'
  | 'front_length'
  | 'height'
  | 'armhole'
  | 'neck_depth_front'
  | 'neck_depth_back'
  | 'neck_circumference'
  | 'bicep'
  | 'wrist'
  | 'elbow'
  | 'inseam'
  | 'thigh'
  | 'knee'
  | 'calf'
  | 'ankle'
  | 'custom';

export interface MeasurementTemplate {
  id: string;
  name: string;
  category_id?: string | null;
  product_id?: string | null;
  customization_type?: CustomizationType | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

interface TemplateFieldRow {
  field_key: MeasurementFieldKey;
  label: string | null;
  is_required: boolean;
  sort_order: number;
  help_text: string | null;
}

// ── Library templates (product_id IS NULL) ─────────────────────────────

export async function getLibraryTemplates(): Promise<MeasurementTemplate[]> {
  const supabase = createUntypedClient();
  const { data, error } = await supabase
    .from('measurement_templates')
    .select('*')
    .is('product_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTemplateById(
  id: string
): Promise<MeasurementTemplate | null> {
  const supabase = createUntypedClient();
  const { data, error } = await supabase
    .from('measurement_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createLibraryTemplate(
  name: string
): Promise<MeasurementTemplate> {
  const supabase = createUntypedClient();
  const { data, error } = await supabase
    .from('measurement_templates')
    .insert({ name, product_id: null, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  const supabase = createUntypedClient();
  const { error } = await supabase
    .from('measurement_templates')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

// Categories currently assigned to a template (so the delete dialog can warn).
export async function getCategoriesUsingTemplate(
  templateId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = createUntypedClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('measurement_template_id', templateId)
    .is('deleted_at', null);
  if (error) throw error;
  return data || [];
}

// Soft-delete a library template. The FK is ON DELETE SET NULL, but we soft-
// delete (deleted_at) rather than hard-delete, so we explicitly null any
// category assignments to keep inheritance consistent. Product override
// copies are independent rows and are untouched.
export async function softDeleteTemplate(id: string): Promise<void> {
  const supabase = createUntypedClient();
  const { error: catError } = await supabase
    .from('categories')
    .update({ measurement_template_id: null })
    .eq('measurement_template_id', id);
  if (catError) throw catError;

  const { error } = await supabase
    .from('measurement_templates')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ── Product override (product_id = productId) ──────────────────────────

export async function getProductOverride(
  productId: string
): Promise<MeasurementTemplate | null> {
  const supabase = createUntypedClient();
  const { data, error } = await supabase
    .from('measurement_templates')
    .select('*')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Create a product-owned override, snapshot-copying the fields of `sourceId`
// (the category's template) if given. If sourceId is null, starts blank.
export async function createOverride(
  productId: string,
  sourceTemplateId: string | null
): Promise<MeasurementTemplate> {
  const supabase = createUntypedClient();
  const { data: created, error } = await supabase
    .from('measurement_templates')
    .insert({ name: 'Product override', product_id: productId, is_active: true })
    .select()
    .single();
  if (error) throw error;

  if (sourceTemplateId) {
    const { data: srcFields, error: fErr } = await supabase
      .from('measurement_template_fields')
      .select('field_key, label, is_required, sort_order, help_text')
      .eq('template_id', sourceTemplateId);
    if (fErr) throw fErr;
    if (srcFields && srcFields.length > 0) {
      const copies = (srcFields as TemplateFieldRow[]).map((f) => ({
        template_id: created.id,
        field_key: f.field_key,
        label: f.label,
        is_required: f.is_required,
        sort_order: f.sort_order,
        help_text: f.help_text,
      }));
      const { error: cErr } = await supabase
        .from('measurement_template_fields')
        .insert(copies);
      if (cErr) throw cErr;
    }
  }
  return created;
}

// Remove an override; product reverts to inheriting from its category.
export async function deleteOverride(overrideId: string): Promise<void> {
  const supabase = createUntypedClient();
  const { error: fErr } = await supabase
    .from('measurement_template_fields')
    .delete()
    .eq('template_id', overrideId);
  if (fErr) throw fErr;
  const { error } = await supabase
    .from('measurement_templates')
    .delete()
    .eq('id', overrideId);
  if (error) throw error;
}
