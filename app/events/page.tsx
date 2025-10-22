import { Footer } from "@/components/layout/Footer";
import { EventsPageClient } from "@/components/eventsPageClient";
import { createSupabaseClient } from "../utils/supabase/server";
import { EventRole, EventVisibility } from "@/lib/types";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

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

      // Get event IDs where user is an organizer
      const organizerEventIds = userRoles
        .filter((role) => role.role === EventRole.Organizer)
        .map((role) => role.event_id);

      // Build query for events based on visibility and user role
      let query = supabase.from("events").select("*");

      if (isAdmin) {
        // Admins can see all events (public, private, draft, demo, test)
        // No additional filter needed
      } else if (organizerEventIds.length > 0) {
        // Organizers:
        // - Public events (discoverable by everyone)
        // - Their own Private/Unlisted/Draft/Archived events
        const idsList = organizerEventIds.join(",");
        const organizerOnlyVis = [
          EventVisibility.Private,
          EventVisibility.Unlisted,
          EventVisibility.Draft,
          EventVisibility.Archived,
        ].join(",");
        query = query.or(
          `visibility.eq.${EventVisibility.Public},` +
            `and(event_id.in.(${idsList}),visibility.in.(${organizerOnlyVis}))`
        );
      } else {
        // Regular users only see public events
        query = query.eq("visibility", EventVisibility.Public);
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
      // Fetch only public events (discoverable)
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("visibility", EventVisibility.Public)
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
    <PageContainer showBorder={isAuthenticated}>
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col gap-[24px] px-[32px]">
          <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
            Events
          </h1>
          <div className="flex flex-col gap-[24px]">
            <EventsPageClient eventsList={eventsList} />

            {/* Discord CTA on events page */}
            <div className="mt-12">
              <DiscordCTA variant="default" />
            </div>
          </div>
        </div>
      </PageContent>
      {!isAuthenticated && <Footer />}
    </PageContainer>
  );
}
