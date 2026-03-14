-- Keep kandq-photos private; app serves signed URLs via API routes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kandq-photos', 'kandq-photos', false)
ON CONFLICT (id) DO UPDATE
SET public = false,
    name = EXCLUDED.name;

-- Remove legacy public-read policy if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read kandq photos'
  ) THEN
    DROP POLICY "Public read kandq photos" ON storage.objects;
  END IF;
END
$$;
