import { JoinEventButton } from "@/components/events/join-event-button";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { CommunityButtons } from "./community-buttons";
import { Resource } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase
    .from("events")
    .select("event_id, event_name, event_blurb, slug, event_resources");

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error } = await query.single();

  if (error || !eventData) {
    notFound();
  }

  // Check if user is authenticated and already registered
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: existingRegistration } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    // If user is already registered, redirect to overview page
    if (existingRegistration) {
      const overviewUrl = `/events/${eventData.slug || eventData.event_id}/overview`;
      return redirect(overviewUrl);
    }
  }

  // Extract WhatsApp and Discord links from event resources
  const whatsappLink = eventData.event_resources?.find((resource: Resource) =>
    resource.name.toLowerCase().includes("whatsapp")
  )?.link;

  const discordLink = eventData.event_resources?.find((resource: Resource) =>
    resource.name.toLowerCase().includes("discord")
  )?.link;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 text-center max-w-2xl w-full">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              You&apos;re invited to join
            </h1>
            <h2 className="text-2xl sm:text-3xl font-semibold text-blue-700 mb-4">
              {eventData.event_name}
            </h2>

            {/* Time-sensitive confirmation message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-orange-800 font-medium text-sm">
                ⏰ Accept this invitation in the next 48 hours to confirm your
                spot
              </p>
            </div>

            {eventData.event_blurb && (
              <p className="max-w-xl mx-auto mb-8 text-gray-600 text-lg leading-relaxed">
                {eventData.event_blurb}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* Primary Accept Button */}
            <JoinEventButton
              eventId={eventData.event_id}
              eventName={eventData.event_name}
              label="Accept Invitation"
            />

            {/* Community Buttons */}
            <CommunityButtons
              whatsappLink={whatsappLink}
              discordLink={discordLink}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
