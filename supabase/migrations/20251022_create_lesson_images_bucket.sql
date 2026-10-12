-- Create storage bucket for lesson images
-- This bucket stores cover images for event lessons uploaded by organizers

-- Create the bucket (public bucket for easy access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-images', 'lesson-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Organizers and admins can upload lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Organizers and admins can update lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Organizers and admins can delete lesson images" ON storage.objects;

-- Allow organizers and admins to upload images
CREATE POLICY "Organizers and admins can upload lesson images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-images' AND
  EXISTS (
    SELECT 1 FROM user_event_roles
    WHERE user_id = auth.uid()
    AND role IN ('organizer', 'admin')
    -- Extract event_id from the path (format: eventId/timestamp-filename)
    -- The path is stored in 'name', split by '/' and take first part
    -- Cast to UUID to match event_id column type
    AND event_id = split_part(name, '/', 1)::uuid
  )
);

-- Allow public viewing of lesson images (since bucket is public)
CREATE POLICY "Public can view lesson images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lesson-images');

-- Allow organizers and admins to update their event's images
CREATE POLICY "Organizers and admins can update lesson images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-images' AND
  EXISTS (
    SELECT 1 FROM user_event_roles
    WHERE user_id = auth.uid()
    AND role IN ('organizer', 'admin')
    AND event_id = split_part(name, '/', 1)::uuid
  )
);

-- Allow organizers and admins to delete their event's images
CREATE POLICY "Organizers and admins can delete lesson images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-images' AND
  EXISTS (
    SELECT 1 FROM user_event_roles
    WHERE user_id = auth.uid()
    AND role IN ('organizer', 'admin')
    AND event_id = split_part(name, '/', 1)::uuid
  )
);
