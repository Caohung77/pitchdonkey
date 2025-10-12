-- Create storage bucket for persona knowledge (PDFs and other files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-knowledge', 'persona-knowledge', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own persona knowledge folder
CREATE POLICY "Users can upload to their own persona knowledge"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own persona knowledge
CREATE POLICY "Users can read their own persona knowledge"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own persona knowledge
CREATE POLICY "Users can update their own persona knowledge"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own persona knowledge
CREATE POLICY "Users can delete their own persona knowledge"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public access for reading (needed for Jina AI to access uploaded PDFs)
CREATE POLICY "Public can read persona knowledge"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'persona-knowledge');
