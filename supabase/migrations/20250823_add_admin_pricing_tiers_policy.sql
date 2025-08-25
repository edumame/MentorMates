-- Add policy for admin users to see any pricing tiers
CREATE POLICY "Admin users can view all pricing tiers"
ON "public"."pricing_tiers"
FOR SELECT
TO public
USING (
  (SELECT is_admin_user(auth.uid()::uuid))
);

COMMENT ON POLICY "Admin users can view all pricing tiers" ON "public"."pricing_tiers"
IS 'Allows admin users to view all pricing tiers regardless of event visibility or tier status';