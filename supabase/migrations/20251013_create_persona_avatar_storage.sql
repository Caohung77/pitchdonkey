-- Create storage bucket for persona avatars (generated headshots)
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-avatars', 'persona-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own persona avatars folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can upload to their own persona avatars'
  ) THEN
    CREATE POLICY "Users can upload to their own persona avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'persona-avatars' AND
      (storage.foldername(name))[1] = 'avatars' AND
      (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;

-- Policy: Users can read their own persona avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can read their own persona avatars'
  ) THEN
    CREATE POLICY "Users can read their own persona avatars"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'persona-avatars' AND
      (storage.foldername(name))[1] = 'avatars' AND
      (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;

-- Policy: Users can update their own persona avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can update their own persona avatars'
  ) THEN
    CREATE POLICY "Users can update their own persona avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'persona-avatars' AND
      (storage.foldername(name))[1] = 'avatars' AND
      (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;

-- Policy: Users can delete their own persona avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can delete their own persona avatars'
  ) THEN
    CREATE POLICY "Users can delete their own persona avatars"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'persona-avatars' AND
      (storage.foldername(name))[1] = 'avatars' AND
      (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;

-- Public access for reading (needed to display avatars in UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public can read persona avatars'
  ) THEN
    CREATE POLICY "Public can read persona avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'persona-avatars');
  END IF;
END $$;
