"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InvitationStatus } from "../types";
import type { InvitationStatusType } from "../types";

interface InvitationStatusBadgeProps {
  status: InvitationStatusType;
  className?: string;
}

const statusConfig: Record<
  InvitationStatusType,
  { label: string; className: string }
> = {
  [InvitationStatus.PENDING]: {
    label: "Pending",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  [InvitationStatus.APPROVED]: {
    label: "Approved",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  [InvitationStatus.SENT]: {
    label: "Sent",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  [InvitationStatus.ACCEPTED]: {
    label: "Accepted",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  [InvitationStatus.EXPIRED]: {
    label: "Expired",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  [InvitationStatus.BOUNCED]: {
    label: "Bounced",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  [InvitationStatus.DECLINED]: {
    label: "Declined",
    className: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

export function InvitationStatusBadge({
  status,
  className,
}: InvitationStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig[InvitationStatus.PENDING];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

