"use client";

import React from "react";
import { EventRole } from "@/lib/types";
import { getAccessibleRoles, getRoleLabel } from "@/features/user/roles/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eye } from "lucide-react";

interface RoleSwitcherProps {
  /**
   * The user's actual assigned role in the event
   */
  actualRole: EventRole;

  /**
   * The currently active role being used for dashboard view
   */
  activeRole: EventRole;

  /**
   * Callback when user switches to a different role view
   */
  onRoleChange: (role: EventRole) => void;

  /**
   * Custom role labels for this event (optional)
   */
  eventRoleLabels?: Record<string, string> | null;

  /**
   * Whether the switcher is disabled
   */
  disabled?: boolean;

  /**
   * Custom className for styling
   */
  className?: string;
}

export function RoleSwitcher({
  actualRole,
  activeRole,
  onRoleChange,
  eventRoleLabels,
  disabled = false,
  className = "",
}: RoleSwitcherProps) {
  // Get all roles that the user can access based on their actual role
  const accessibleRoles = getAccessibleRoles(actualRole);

  // Don't show the switcher if user can only access their own role
  if (accessibleRoles.length <= 1) {
    return null;
  }

  const getCurrentRoleLabel = (role: EventRole) => {
    const baseLabel = getRoleLabel(role, eventRoleLabels);
    return role === actualRole ? baseLabel : `View as ${baseLabel}`;
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="flex items-center gap-2 min-w-[160px] justify-between"
          >
            <div className="flex items-center gap-2">
              {activeRole !== actualRole && (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{getCurrentRoleLabel(activeRole)}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuLabel>Switch Dashboard View</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {accessibleRoles.map((role) => {
            const isActive = role === activeRole;
            const isActualRole = role === actualRole;

            return (
              <DropdownMenuItem
                key={role}
                onClick={() => onRoleChange(role)}
                disabled={isActive}
                className={`cursor-pointer ${isActive ? "bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {!isActualRole && (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      {isActualRole
                        ? getRoleLabel(role, eventRoleLabels)
                        : `View as ${getRoleLabel(role, eventRoleLabels)}`}
                    </span>
                  </div>

                  {isActualRole && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Your Role
                    </span>
                  )}

                  {isActive && !isActualRole && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Current View
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Switch between role views based on your{" "}
            {getRoleLabel(actualRole, eventRoleLabels)} permissions.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default RoleSwitcher;
