import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { VotingContent } from "@/components/voting/voting-content";
import { VotingResultsPanel } from "@/components/voting/voting-results-panel";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VotingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    cover_image_url,
    slug,
    paid,
    owner_id
  `);

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error: eventError } = await query.single();

  if (eventError || !eventData) {
    notFound();
  }

  // Check if user has joined and their role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;
  let userRole: string | null = null;
  let isOrganizer = false;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
    userRole = userEventRole?.role || null;
    
    // Check if user is organizer or event owner
    isOrganizer = 
      userRole === "organizer" || 
      eventData.owner_id === user.id;
  }

  // Determine which view to show based on role and query param
  const showResults = resolvedSearchParams.results === "true" && isOrganizer;

  return (
    <EventPageLayout
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb || ""}
      eventDate={eventData.event_date}
      location={eventData.location}
      coverImageUrl={eventData.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={eventData.paid}
    >
      {showResults ? (
        <VotingResultsPanel eventId={eventData.event_id} />
      ) : (
        <VotingContent eventId={eventData.event_id} hasJoined={hasJoined} />
      )}
      
      {/* Show link to results for organizers */}
      {isOrganizer && !showResults && (
        <div className="mt-8 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl">
          <p className="text-[#1e3a8a] text-sm">
            <strong>Organizer:</strong> You can view detailed voting results{" "}
            <a
              href={`/events/${id}/voting?results=true`}
              className="underline font-medium hover:text-[#2563eb]"
            >
              here
            </a>
            .
          </p>
        </div>
      )}
      
      {/* Show link back to voting for organizers viewing results */}
      {isOrganizer && showResults && (
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-gray-700 text-sm">
            <a
              href={`/events/${id}/voting`}
              className="underline font-medium hover:text-[#4B89EF]"
            >
              ← Back to voting page
            </a>
          </p>
        </div>
      )}
    </EventPageLayout>
  );
}
