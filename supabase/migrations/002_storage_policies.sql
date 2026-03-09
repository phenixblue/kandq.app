-- Allow authenticated users to upload files to a specific bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kandq-photos'); -- Adjust bucket_id as needed

-- Frequently, a SELECT policy is also required to return the uploaded object's metadata
CREATE POLICY "Allow authenticated selects"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'kandq-photos'); -- Adjust bucket_id as needed