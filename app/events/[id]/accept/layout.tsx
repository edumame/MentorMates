import type React from "react";

export default function AcceptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clean layout with no wrappers - the accept page handles its own layout
  return <>{children}</>;
}

