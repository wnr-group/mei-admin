-- Add 'custom' to the measurement_field_key enum.
-- Kept in its own migration: Postgres forbids using a newly added enum value
-- in the same transaction that adds it, so the partial index that references
-- 'custom' must live in a later migration (20260711120000).
ALTER TYPE measurement_field_key ADD VALUE IF NOT EXISTS 'custom';
