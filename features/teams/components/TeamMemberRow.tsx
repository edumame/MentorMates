"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TeamMemberRole, TeamMemberWithProfile } from "@/lib/types/team";

interface TeamMemberRowProps {
  member: TeamMemberWithProfile;
  // When provided, shows a remove control that calls onRemove with the user id.
  onRemove?: (userId: string) => void;
  removing?: boolean;
  isCurrentUser?: boolean;
}

export function TeamMemberRow({
  member,
  onRemove,
  removing = false,
  isCurrentUser = false,
}: TeamMemberRowProps) {
  const name = member.display_name || member.email || "Team member";

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-gray-200 text-black font-semibold text-sm">
          {(name[0] || "?").toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[15px] leading-tight text-black truncate">
          {name}
          {isCurrentUser && (
            <span className="text-gray-500 font-normal"> (you)</span>
          )}
        </p>
        {member.email && (
          <p className="text-[13px] text-gray-500 truncate">{member.email}</p>
        )}
      </div>
      {member.role === TeamMemberRole.Lead && (
        <Badge variant="secondary">Lead</Badge>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={removing}
          onClick={() => onRemove(member.user_id)}
          aria-label={`Remove ${name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
