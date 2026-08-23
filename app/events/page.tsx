import { Footer } from "@/components/layout/Footer";
import { EventsPageClient } from "@/components/eventsPageClient";
import { createSupabaseClient } from "../utils/supabase/server";
import { EventVisibility, ApprovalStatus } from "@/lib/types";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { isEventManagerRole } from "@/lib/events/navigation";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  const isAdminGlobal = isAuthenticated
    ? (await supabase.rpc("is_admin_user", { user_id: user!.id })).data || false
    : false;

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

      const isAdmin = isAdminGlobal;
      
      let query = supabase.from("events").select("*");

      if (isAdmin) {
        // Admins can see all events regardless of approval status
        // No additional filter needed
      } else {
        // Regular users only see public events that are approved
        query = query
          .in("visibility", [EventVisibility.Public])
          .eq("approval_status", ApprovalStatus.Approved);
      }

      const { data: events, error: eventsError } = await query;

      if (eventsError) throw eventsError;

      // Include user role with each event
      const eventsWithRole = events
        .map((event) => {
          const userRole =
            userRoles.find((role) => role.event_id === event.event_id)?.role ||
            null;
          return {
            ...event,
            userRole,
            canManageEvent: isAdmin || isEventManagerRole(userRole),
          };
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
      // Fetch only public events
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .in("visibility", [EventVisibility.Public])
        .eq("approval_status", ApprovalStatus.Approved)
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

  return (
    <>
      <div
        className={
          isAuthenticated ? "pb-8 pt-0 lg:pt-[24px]" : "pb-8 pt-[24px]"
        }
      >
        <div
          className={
            isAuthenticated
              ? "flex min-w-0 max-w-full flex-col gap-[24px] overflow-x-clip px-4 sm:px-6 lg:px-[32px]"
              : "mx-auto flex min-w-0 w-full max-w-10xl flex-col overflow-x-clip px-4 md:px-10"
          }
        >
          <div className="flex flex-col gap-[24px]">
            <EventsPageClient
              eventsList={eventsList}
              initialIsAuthenticated={isAuthenticated}
            />

            {/* Discord CTA on events page */}
            <div className="mt-12">
              <DiscordCTA variant="default" />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
