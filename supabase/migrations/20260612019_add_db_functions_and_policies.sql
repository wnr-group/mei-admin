CREATE OR REPLACE FUNCTION generate_variant_sku(
  p_product_code TEXT,
  p_color        TEXT,
  p_size         TEXT,
  p_type         customization_type
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  type_code TEXT := CASE p_type
    WHEN 'UNSTITCHED'      THEN 'UN'
    WHEN 'SEMI_STITCHED'   THEN 'SS'
    WHEN 'STANDARD_SIZE'   THEN 'ST'
    WHEN 'CUSTOM_TAILORED' THEN 'CT'
  END;
BEGIN
  RETURN UPPER(
    p_product_code || '-' ||
    LEFT(REGEXP_REPLACE(COALESCE(p_color, 'DEF'), '\s+', '', 'g'), 3) || '-' ||
    REGEXP_REPLACE(COALESCE(p_size, 'STD'), '\s+', '', 'g') || '-' ||
    type_code
  );
END; $$;
