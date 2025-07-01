import { Footer } from "@/components/layout/footer";
import { EventsPageClient } from "@/components/eventsPageClient";
import { createSupabaseClient } from "../utils/supabase/server";
import { EventRole, EventVisibility } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  async function fetchAuthenticatedUserEvents() {
    try {
      if (!isAuthenticated) {
        console.error("User not authenticated");
        return [];
      }

      const userId = user.id;

      // Get user's roles in all events
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_event_roles")
        .select("event_id, role")
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Check if user is an admin in any event
      const { data } = await supabase.rpc("is_admin_user", { user_id: userId });

      const isAdmin = data || false;

      // Get event IDs where user is an organizer
      const organizerEventIds = userRoles
        .filter((role) => role.role === EventRole.Organizer)
        .map((role) => role.event_id);

      // Build query for events based on visibility and user role
      let query = supabase.from("events").select("*");

      if (isAdmin) {
        // Admins can see all events except archived ones (public, private, draft, demo, test)
        query = query.neq("visibility", EventVisibility.Archived);
      } else if (organizerEventIds.length > 0) {
        // For organizers:
        // - Public and private events (visible to everyone)
        // - Draft events where user is an organizer
        // - No demo, test, or archived events
        query = query.or(
          `visibility.in.(${[
            EventVisibility.Public,
            EventVisibility.Private,
          ].join(",")}),` +
            `and(visibility.eq.${
              EventVisibility.Draft
            },event_id.in.(${organizerEventIds.join(",")}))`
        );
      } else {
        // Regular users only see public and private events (no archived events)
        query = query.in("visibility", [
          EventVisibility.Public,
          EventVisibility.Private,
        ]);
      }

      const { data: events, error: eventsError } = await query;

      if (eventsError) throw eventsError;

      // Include user role with each event
      const eventsWithRole = events
        .map((event) => {
          const userRole =
            userRoles.find((role) => role.event_id === event.event_id)?.role ||
            null;
          return { ...event, userRole };
        })
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        );

      return eventsWithRole;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  }

  async function fetchPublicEvents() {
    try {
      // Only fetch public and private events (no archived events)
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .in("visibility", [EventVisibility.Public, EventVisibility.Private])
        .order("event_date", { ascending: false });

      if (error) throw error;

      // For non-authenticated users, userRole is always null
      return events.map((event) => ({ ...event, userRole: null }));
    } catch (error) {
      console.error("Error fetching public events:", error);
      return [];
    }
  }

  // Fetch events based on authentication status
  const events = isAuthenticated
    ? await fetchAuthenticatedUserEvents()
    : await fetchPublicEvents();

  const eventsList = events || [];

  // Check if user can view archived events
  const canViewArchived = isAuthenticated && (
    await (async () => {
      if (!user) return false;
      
      const { data: userRoles } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("user_id", user.id);

      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });

      const hasOrganizerRole = userRoles?.some((role: any) => 
        ["organizer", "admin"].includes(role.role)
      );

      return isAdmin || hasOrganizerRole;
    })()
  );

  return (
    <div className="min-h-[90vh] flex flex-col bg-gray-50">
      <div className="flex-grow">
        <div className="max-w-7xl mx-auto py-8 px-6 lg:px-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-blue-900 flex-1">
              Events
            </h1>
            {canViewArchived && (
              <a
                href="/events/archived"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                View Archived Events
              </a>
            )}
          </div>
          <EventsPageClient eventsList={eventsList} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
