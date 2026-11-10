import type { Metadata } from "next";

// Keep the existing /events/:id/accept-* URLs outside the event detail layout:
// invitees may not yet have permission to read a draft event, and invitations
// must not follow the event's external-site redirect before acceptance.
export const metadata: Metadata = {
  title: "Event invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
