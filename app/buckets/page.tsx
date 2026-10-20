import { createSupabaseClient } from "@/app/utils/supabase/server";
import { BucketManagement } from "@/components/buckets/bucket-management";
import { EventRole } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BucketsPage() {
  const supabase = await createSupabaseClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if user has admin role or organizer role in any event
  const { data: userRoles } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user.id);

  const hasAdminRole = userRoles?.some(role => role.role === EventRole.Admin);
  const hasOrganizerRole = userRoles?.some(role => role.role === EventRole.Organizer);

  if (!hasAdminRole && !hasOrganizerRole) {
    redirect("/events");
  }

  const userRole = hasAdminRole ? "admin" : "organizer";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-6 lg:px-10">
        <BucketManagement userRole={userRole} />
      </div>
    </div>
  );
}