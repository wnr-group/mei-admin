-- Create enquiry-images storage bucket for storefront reference image uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('enquiry-images', 'enquiry-images', true)
ON CONFLICT (id) DO NOTHING;
