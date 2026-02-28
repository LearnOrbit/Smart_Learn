
-- Add extracted_text and image_path columns to submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS image_path text;

-- Create storage bucket for submission images
INSERT INTO storage.buckets (id, name, public) VALUES ('submission-images', 'submission-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: students can upload their own images
CREATE POLICY "Students can upload submission images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'submission-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view submission images"
ON storage.objects FOR SELECT
USING (bucket_id = 'submission-images');

CREATE POLICY "Students can delete own submission images"
ON storage.objects FOR DELETE
USING (bucket_id = 'submission-images' AND auth.uid()::text = (storage.foldername(name))[1]);
