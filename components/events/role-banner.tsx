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
        return `You are viewing this ${eventType} as ${roleLabel.toLowerCase()}`;
      case "admin":
        return `You are viewing this ${eventType} as an ${roleLabel.toLowerCase()}`;
      default:
        return `You are viewing this ${eventType}`;
    }
  };

  return (
    <div className="sticky top-0 z-50 mb-8 w-full min-w-0 max-w-full overflow-hidden border-b border-[rgba(0,0,0,0.15)] bg-sky-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
          <Headphones className="h-5 w-5 sm:h-6 sm:w-6 text-[#4c4c4c] flex-shrink-0 mt-0.5 sm:mt-0" />

          {/* Desktop: Text with optional chevron dropdown */}
          <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
            <p className="text-[#4c4c4c] text-base sm:text-lg font-medium tracking-[-0.06em] leading-[1.4]">
              {getRoleText()}
            </p>
            {canSwitchRoles && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-[#4c4c4c] hover:text-black transition-colors">
                  <span className="font-medium tracking-[-0.06em] leading-[1.4] underline text-black/[0.6]">
                    View as {getRoleLabel(activeRole, eventRoleLabels).toLowerCase()}
                  </span>
                  <ChevronDown className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[240px]">
                  <span className="inline-block mb-2 text-sm font-medium tracking-[-0.06em] leading-[1.4] text-[#4c4c4c] pl-3 pt-1.5">Switch Dashboard View</span>
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
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {`View as ${label}`}
                            </span>
                          </div>

                          {isActualRole && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full border border-[#7CD4FD] text-[#7CD4FD] bg-[#F0F9FF]">
                              Your Role
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <div className="px-2 py-1.5 text-xs text-[#aaa]">
                    Switch between role views based on your permission
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile: Entire text as dropdown */}
          <div className="sm:hidden flex-1 min-w-0">
            {canSwitchRoles ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 w-full min-w-0 text-left text-[#4c4c4c] hover:text-black transition-colors">
                  <span className="text-sm font-medium tracking-[-0.06em] leading-[1.4] min-w-0 flex-1">
                    {getRoleText()}
                  </span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
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
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {`View as ${label}`}
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
            ) : (
              <p className="text-[#4c4c4c] text-sm font-medium tracking-[-0.06em] leading-[1.4] line-clamp-2">
                {getRoleText()}
              </p>
            )}
          </div>
        </div>

        {onCancelRegistration && (
          <button
            onClick={onCancelRegistration}
            className="text-[#d92d20] text-sm sm:text-base font-medium leading-[1.5] underline hover:no-underline whitespace-nowrap flex-shrink-0 self-end sm:self-auto"
          >
            Cancel registration
          </button>
        )}
      </div>
    </div>
  );
}
