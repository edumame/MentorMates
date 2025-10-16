"use client";

import { Headphones } from "lucide-react";
import { EventRole } from "@/lib/types";
import { getAccessibleRoles, getRoleLabel } from "@/features/user/roles/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Eye } from "lucide-react";

interface RoleBannerProps {
  actualRole: EventRole;
  activeRole: EventRole;
  onRoleChange: (role: EventRole) => void;
  eventType?: string;
  onCancelRegistration?: () => void;
  eventRoleLabels?: Record<string, string> | null;
}

export function RoleBanner({
  actualRole,
  activeRole,
  onRoleChange,
  eventType = "event",
  onCancelRegistration,
  eventRoleLabels,
}: RoleBannerProps) {
  const accessibleRoles = getAccessibleRoles(actualRole);
  const canSwitchRoles = accessibleRoles.length > 1;

  const getRoleText = () => {
    const roleLabel = getRoleLabel(activeRole, eventRoleLabels);
    const isViewingAsOtherRole = activeRole !== actualRole;

    if (isViewingAsOtherRole) {
      return `You are viewing this ${eventType} as ${roleLabel.toLowerCase()}`;
    }

    switch (activeRole) {
      case "participant":
        return `You are participating in this ${eventType} as a ${roleLabel.toLowerCase()}`;
      case "mentor":
        return `You are participating in this ${eventType} as a ${roleLabel.toLowerCase()}`;
      case "judge":
        return `You are participating in this ${eventType} as a ${roleLabel.toLowerCase()}`;
      case "organizer":
        return `You are organizing this ${eventType}`;
      case "admin":
        return `You are viewing this ${eventType} as an ${roleLabel.toLowerCase()}`;
      default:
        return `You are viewing this ${eventType}`;
    }
  };

  return (
    <div className="sticky top-0 z-20 bg-sky-50 border-b border-[rgba(0,0,0,0.15)]">
      <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Headphones className="h-6 w-6 text-[#4c4c4c]" />
          <p className="text-[#4c4c4c] text-lg font-medium tracking-[-0.06em] leading-[1.4]">
            {getRoleText()}
          </p>
          {canSwitchRoles && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-[#4c4c4c] hover:text-black transition-colors ml-2">
                <ChevronDown className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                {accessibleRoles.map((role) => {
                  const isActive = role === activeRole;
                  const isActualRole = role === actualRole;
                  const label = getRoleLabel(role, eventRoleLabels);

                  return (
                    <DropdownMenuItem
                      key={role}
                      onClick={() => onRoleChange(role)}
                      disabled={isActive}
                      className={`cursor-pointer ${isActive ? "bg-accent" : ""}`}
                    >
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2">
                          {!isActualRole && (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>
                            {isActualRole ? label : `View as ${label}`}
                          </span>
                        </div>

                        {isActualRole && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Your Role
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Switch between role views
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {onCancelRegistration && actualRole === "participant" && (
          <button
            onClick={onCancelRegistration}
            className="text-[#d92d20] text-base font-medium leading-[1.5] underline hover:no-underline whitespace-nowrap"
          >
            Cancel registration
          </button>
        )}
      </div>
    </div>
  );
}
