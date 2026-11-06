import type React from "react";

export default function AcceptOrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clean layout with no wrappers - the accept-organizer page handles its own layout
  return <>{children}</>;
}

