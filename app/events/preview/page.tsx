import { EventVisibility, ApprovalStatus, type EventItem } from "@/lib/types";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-static";

const SAMPLE_EVENTS: EventItem[] = [
  {
    event_id: "sample-1",
    slug: "boston-protocol-bostechweek",
    event_name: "Boston Protocol: Hacking Healthcare — #BOSTechWeek",
    event_blurb:
      "Apply if you want to *build* the future of healthcare for a full day. Founders, clinicians, designers.",
    event_date: "2026-05-27T09:00:00",
    location: "BASE-X, 60 State St Suite 1400, Boston, MA 02109",
    cover_image_url: "/event-backgrounds/1.png",
    event_type: ["hackathon"],
    visibility: EventVisibility.Public,
    approval_status: ApprovalStatus.Approved,
    featured: true,
  },
  {
    event_id: "sample-2",
    slug: "sea-hacks-2026",
    event_name: "SEA Hacks 2026",
    event_blurb:
      "By invite. Everything IRL. A 2-day AI hackathon bringing Silicon Valley's builder culture to Asia.",
    event_date: "2026-07-04T10:00:00",
    location: "Hong Kong Island, Hong Kong",
    cover_image_url: "/event-backgrounds/2.png",
    event_type: ["hackathon", "summit"],
    visibility: EventVisibility.Public,
    approval_status: ApprovalStatus.Approved,
    featured: false,
  },
  {
    event_id: "sample-3",
    slug: "founders-bridge-demo-day",
    event_name: "Founders Bridge — Spring Cohort Demo Day",
    event_blurb:
      "Showcase from Chimeboard, Tenda, and RIFFAI. Investors, mentors, and friends only.",
    event_date: "2026-05-30T17:00:00",
    location: "Stanford University, Palo Alto, CA",
    cover_image_url: undefined,
    event_type: ["demo-day"],
    visibility: EventVisibility.Public,
    approval_status: ApprovalStatus.Approved,
    featured: false,
  },
  {
    event_id: "sample-4",
    slug: "remote-ai-tinkering",
    event_name: "Remote AI Tinkering Night",
    event_blurb: "Bring a half-built side project. Two hours, no slides, group debugging.",
    event_date: "2026-06-12T19:00:00",
    location: "Remote",
    cover_image_url: undefined,
    event_type: ["workshop"],
    visibility: EventVisibility.Public,
    approval_status: ApprovalStatus.Approved,
    featured: false,
  },
];

export default function EventsCardPreviewPage() {
  return <PreviewClient events={SAMPLE_EVENTS} />;
}
