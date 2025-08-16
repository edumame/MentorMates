-- Create event buckets table
CREATE TABLE IF NOT EXISTS "public"."event_buckets" (
    "bucket_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "bucket_name" TEXT NOT NULL,
    "bucket_description" TEXT,
    "bucket_slug" TEXT UNIQUE NOT NULL,
    "bucket_color" TEXT DEFAULT '#3B82F6', -- Default blue color
    "bucket_icon" TEXT, -- Icon name or emoji
    "visibility" "public"."event_visibility" DEFAULT 'private'::"public"."event_visibility" NOT NULL,
    "created_by" UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Add bucket_id to events table
ALTER TABLE "public"."events" 
ADD COLUMN IF NOT EXISTS "bucket_id" UUID REFERENCES "public"."event_buckets"("bucket_id") ON DELETE SET NULL;

-- Create bucket permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS "public"."bucket_permissions" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "bucket_id" UUID NOT NULL REFERENCES "public"."event_buckets"("bucket_id") ON DELETE CASCADE,
    "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "permission" TEXT NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
    "granted_by" UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    "granted_at" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bucket_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_buckets_slug ON "public"."event_buckets"("bucket_slug");
CREATE INDEX IF NOT EXISTS idx_event_buckets_visibility ON "public"."event_buckets"("visibility");
CREATE INDEX IF NOT EXISTS idx_event_buckets_created_by ON "public"."event_buckets"("created_by");
CREATE INDEX IF NOT EXISTS idx_events_bucket_id ON "public"."events"("bucket_id");
CREATE INDEX IF NOT EXISTS idx_bucket_permissions_bucket_id ON "public"."bucket_permissions"("bucket_id");
CREATE INDEX IF NOT EXISTS idx_bucket_permissions_user_id ON "public"."bucket_permissions"("user_id");

-- Create RLS policies for event buckets
ALTER TABLE "public"."event_buckets" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read buckets they have permission to or public buckets
CREATE POLICY "bucket_read_policy" ON "public"."event_buckets"
    FOR SELECT USING (
        visibility = 'public' OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM "public"."bucket_permissions" 
            WHERE bucket_id = event_buckets.bucket_id 
            AND user_id = auth.uid()
        )
    );

-- Policy: Only bucket creators and admins can update buckets
CREATE POLICY "bucket_update_policy" ON "public"."event_buckets"
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM "public"."bucket_permissions" 
            WHERE bucket_id = event_buckets.bucket_id 
            AND user_id = auth.uid() 
            AND permission = 'admin'
        )
    );

-- Policy: Only authenticated users can create buckets
CREATE POLICY "bucket_insert_policy" ON "public"."event_buckets"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only bucket creators and admins can delete buckets
CREATE POLICY "bucket_delete_policy" ON "public"."event_buckets"
    FOR DELETE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM "public"."bucket_permissions" 
            WHERE bucket_id = event_buckets.bucket_id 
            AND user_id = auth.uid() 
            AND permission = 'admin'
        )
    );

-- Enable RLS for bucket permissions
ALTER TABLE "public"."bucket_permissions" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read permissions for buckets they have access to
CREATE POLICY "bucket_permissions_read_policy" ON "public"."bucket_permissions"
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM "public"."event_buckets" 
            WHERE bucket_id = bucket_permissions.bucket_id 
            AND created_by = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM "public"."bucket_permissions" bp2
            WHERE bp2.bucket_id = bucket_permissions.bucket_id 
            AND bp2.user_id = auth.uid() 
            AND bp2.permission = 'admin'
        )
    );

-- Policy: Only bucket creators and admins can manage permissions
CREATE POLICY "bucket_permissions_write_policy" ON "public"."bucket_permissions"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "public"."event_buckets" 
            WHERE bucket_id = bucket_permissions.bucket_id 
            AND created_by = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM "public"."bucket_permissions" bp2
            WHERE bp2.bucket_id = bucket_permissions.bucket_id 
            AND bp2.user_id = auth.uid() 
            AND bp2.permission = 'admin'
        )
    );

-- Create function to check bucket access
CREATE OR REPLACE FUNCTION "public"."check_bucket_access"(
    "bucket_id_param" UUID,
    "user_id_param" UUID,
    "required_permission" TEXT DEFAULT 'read'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is bucket creator
    IF EXISTS (
        SELECT 1 FROM "public"."event_buckets" 
        WHERE bucket_id = bucket_id_param 
        AND created_by = user_id_param
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has required permission
    IF EXISTS (
        SELECT 1 FROM "public"."bucket_permissions" 
        WHERE bucket_id = bucket_id_param 
        AND user_id = user_id_param 
        AND (
            permission = required_permission OR
            permission = 'admin' OR
            (required_permission = 'read' AND permission = 'write')
        )
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if bucket is public and permission is read
    IF required_permission = 'read' AND EXISTS (
        SELECT 1 FROM "public"."event_buckets" 
        WHERE bucket_id = bucket_id_param 
        AND visibility = 'public'
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update events RLS to consider bucket permissions
DROP POLICY IF EXISTS "events_select_policy" ON "public"."events";
CREATE POLICY "events_select_policy" ON "public"."events"
    FOR SELECT USING (
        -- Original event visibility logic
        (
            visibility IN ('public', 'private') OR
            (visibility = 'draft' AND EXISTS (
                SELECT 1 FROM user_event_roles 
                WHERE event_id = events.event_id 
                AND user_id = auth.uid() 
                AND role IN ('organizer', 'admin')
            )) OR
            (visibility IN ('demo', 'test') AND EXISTS (
                SELECT 1 FROM user_event_roles 
                WHERE event_id = events.event_id 
                AND user_id = auth.uid() 
                AND role = 'admin'
            ))
        ) AND
        -- Bucket access logic
        (
            bucket_id IS NULL OR
            check_bucket_access(bucket_id, auth.uid(), 'read')
        )
    );

-- Create default "General" bucket for existing events
INSERT INTO "public"."event_buckets" (bucket_name, bucket_description, bucket_slug, visibility)
VALUES ('General', 'Default bucket for general events', 'general', 'public')
ON CONFLICT (bucket_slug) DO NOTHING;