import { Footer } from "@/components/layout/footer";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole, EventVisibility, EventItem } from "@/lib/types";
import { ArchivedEventsClient } from "@/components/events/archived-events-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface EventWithRole extends EventItem {
  userRole: EventRole | null;
}

export default async function ArchivedEventsPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function fetchArchivedEvents(): Promise<EventWithRole[]> {
    try {
      const userId = user.id;

      // Get user's roles in all events
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_event_roles")
        .select("event_id, role")
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Check if user is an admin
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: userId,
      });

      // Get event IDs where user is an organizer or admin
      const organizerEventIds = userRoles
        .filter((role: any) => ["organizer", "admin"].includes(role.role))
        .map((role: any) => role.event_id);

      let query = supabase.from("events").select("*");

      if (isAdmin) {
        // Admins can see all archived events
        query = query.eq("visibility", EventVisibility.Archived);
      } else if (organizerEventIds.length > 0) {
        // Organizers can only see archived events they organized
        query = query
          .eq("visibility", EventVisibility.Archived)
          .in("event_id", organizerEventIds);
      } else {
        // Regular users cannot see archived events
        return [];
      }

      const { data: events, error: eventsError } = await query.order("event_date", { ascending: false });

      if (eventsError) throw eventsError;

      // Include user role with each event
      const eventsWithRole = events.map((event: any) => {
        const userRole =
          userRoles.find((role: any) => role.event_id === event.event_id)?.role ||
          null;
        return { ...event, userRole };
      });

      return eventsWithRole;
    } catch (error) {
      console.error("Error fetching archived events:", error);
      return [];
    }
  }

  // Check if user has permission to view archived events
  const userId = user.id;
  const { data: userRoles } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", userId);

  const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    user_id: userId,
  });

  const hasOrganizerRole = userRoles?.some((role: any) => 
    ["organizer", "admin"].includes(role.role)
  );

  if (!isAdmin && !hasOrganizerRole) {
    redirect("/events");
  }

  const archivedEvents = await fetchArchivedEvents();

  return (
    <div className="min-h-[90vh] flex flex-col bg-gray-50">
      <div className="flex-grow">
        <div className="max-w-7xl mx-auto py-8 px-6 lg:px-10">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-blue-900 mb-4">
              Archived Events
            </h1>
            <p className="text-center text-gray-600 max-w-2xl mx-auto">
              These events have been archived and are in read-only mode. 
              You can still view their details but cannot make changes.
            </p>
          </div>
          <ArchivedEventsClient eventsList={archivedEvents} />
        </div>
      </div>
      <Footer />
    </div>
  );
}