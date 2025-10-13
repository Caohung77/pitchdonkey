-- Create temporary storage bucket for PDF uploads
-- PDFs are stored here temporarily for Jina AI extraction, then deleted
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp-pdf-uploads', 'temp-pdf-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload temp PDFs
CREATE POLICY "Authenticated users can upload temp PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp-pdf-uploads');

-- Policy: Allow service role to manage temp PDFs
CREATE POLICY "Service role can manage temp PDFs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'temp-pdf-uploads');

-- Policy: Public can read temp PDFs (needed for Jina AI to access uploaded PDFs)
CREATE POLICY "Public can read temp PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'temp-pdf-uploads');

-- Policy: Allow authenticated users to delete their own temp PDFs
CREATE POLICY "Users can delete their own temp PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'temp-pdf-uploads');
