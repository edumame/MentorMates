import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface SubmittedToEvent {
  event_id: string;
  event_name: string;
  start_date?: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  event_type?: string[] | null;
  paid?: boolean | null;
  event_blurb?: string | null;
}

/** Columns both project-detail routes read for this card. */
export const SUBMITTED_TO_EVENT_COLUMNS =
  "event_id, event_name, slug, event_date, location, cover_image_url, event_type, paid, event_blurb";

const badgeClassName =
  "bg-transparent border border-black/15 text-black rounded-full font-semibold";

/**
 * "Submitted to" event card, shared by app/projects/[id] and
 * app/projects/public/[id] (CLAUDE.md route parity, NEW-001). Badges and the
 * blurb come from the event row; nothing is rendered when a field is empty.
 */
export function ProjectSubmittedToCard({ event }: { event: SubmittedToEvent }) {
  const eventTypes = (event.event_type ?? []).filter(Boolean);
  const blurb = event.event_blurb?.trim();
  const startDate = event.start_date ? new Date(event.start_date) : null;

  return (
    <div className="space-y-4" data-testid="project-submitted-to">
      <h3 className="text-lg font-bold text-black tracking-tight">Submitted to</h3>
      <Link href={`/events/${event.event_id}/overview`}>
        <Card className="border border-black/15 rounded-xl overflow-hidden hover:shadow-lg">
          <div className="relative">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt={event.event_name}
                className="w-full h-[180px] object-cover"
              />
            ) : (
              <div className="w-full h-[180px] bg-gradient-to-br from-orange-400 via-blue-500 to-purple-600"></div>
            )}
            {startDate && (
              <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-xl py-3 px-1 text-center w-28">
                <p className="text-sm text-black">
                  {startDate.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="text-4xl font-semibold text-black tracking-tight leading-none">
                  {startDate.getDate()}
                </p>
                <p className="text-sm text-black">
                  {startDate.toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
          <CardContent className="p-6 space-y-4">
            {(eventTypes.length > 0 || event.paid) && (
              <div className="flex gap-1 flex-wrap">
                {eventTypes.map((type) => (
                  <Badge key={type} variant="secondary" className={badgeClassName}>
                    {type}
                  </Badge>
                ))}
                {event.paid && (
                  <Badge variant="secondary" className={badgeClassName}>
                    Paid event
                  </Badge>
                )}
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-2xl font-semibold text-black tracking-tight">
                {event.event_name}
              </h4>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="h-4 w-4 text-black" />
                <span className="text-black text-center">{event.location || "Online"}</span>
              </div>
            </div>
            {blurb && <p className="text-base text-black leading-relaxed">{blurb}</p>}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
