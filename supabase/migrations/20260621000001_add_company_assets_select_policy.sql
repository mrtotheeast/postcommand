-- Allow authenticated users to read storage.objects in company-assets.
-- Required for upsert:true uploads: Supabase Storage SELECTs the existing
-- object first to decide INSERT vs UPDATE; without this, that preflight
-- read is blocked by RLS and surfaces as a generic policy violation.
CREATE POLICY "Authenticated users can read company logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'company-assets'::text);
