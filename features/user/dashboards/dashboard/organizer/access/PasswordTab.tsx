"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole, EventDetails } from "@/lib/types";
import { getRoleLabel } from "@/features/user/roles/roles";
import { supabase } from "@/lib/supabase";
import {
  getRolePasswordMinLength,
  ROLE_PASSWORD_MAX_LENGTH,
  type PasswordJoinableRole,
} from "@/lib/roles/role-passwords";

interface PasswordTabProps {
  eventId: string;
  roleLabels?: Record<string, string> | null;
  isArchived: boolean;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

export function PasswordTab({
  eventId,
  roleLabels,
  isArchived,
  event,
  setEvent,
}: PasswordTabProps) {
  const [rolePasswords, setRolePasswords] = useState<Record<EventRole, string>>(
    {} as Record<EventRole, string>
  );
  const [isLoading, setIsLoading] = useState(false);
  // Roles that currently have a password (null while loading / unknown).
  const [configuredRoles, setConfiguredRoles] = useState<Set<string> | null>(null);
  const { toast } = useToast();

  const loadConfiguredRoles = useCallback(async () => {
    // Only (event_id, role) are readable by clients; hashes stay server-side.
    const { data, error } = await supabase
      .from("role_passwords")
      .select("role")
      .eq("event_id", eventId);
    if (error) {
      setConfiguredRoles(null);
      return;
    }
    setConfiguredRoles(new Set((data ?? []).map((row: { role: string }) => row.role)));
  }, [eventId]);

  useEffect(() => {
    void loadConfiguredRoles();
  }, [loadConfiguredRoles]);

  const handlePasswordChange = (role: EventRole, password: string) => {
    setRolePasswords((prev) => ({
      ...prev,
      [role]: password,
    }));
  };

  const handleSetPassword = async (role: PasswordJoinableRole) => {
    const password = rolePasswords[role] || "";
    const minLength = getRolePasswordMinLength(role);
    if (password.length < minLength) {
      toast({
        title: "Password too short",
        description: `Use at least ${minLength} characters.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setIsLoading(true);

      const response = await fetch("/api/roles/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          role,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Error",
          description: data.error || "Failed to set password",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `${role} password updated successfully`,
      });

      // Clear password input
      handlePasswordChange(role, "");
      void loadConfiguredRoles();
    } catch (error) {
      console.error("Error setting password:", error);
      toast({
        title: "Error",
        description: "Failed to set password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePassword = async (role: PasswordJoinableRole) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/roles/set-password", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to remove password",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Password removed", description: `${role} password removed` });
      void loadConfiguredRoles();
    } catch (error) {
      console.error("Error removing password:", error);
      toast({
        title: "Error",
        description: "Failed to remove password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Two-column grid order: left = Participant, Judge; right = Mentor.
  // Organizer access is invitation-only, so it has no role password.
  const leftColumnRoles: PasswordJoinableRole[] = [EventRole.Participant, EventRole.Judge];
  const rightColumnRoles: PasswordJoinableRole[] = [EventRole.Mentor];

  const renderRoleField = (role: PasswordJoinableRole) => {
    const label = getRoleLabel(role, roleLabels);
    const isConfigured = configuredRoles?.has(role) ?? false;
    const minLength = getRolePasswordMinLength(role);
    return (
      <div key={role} className="space-y-2">
        <label className="text-sm font-medium text-[var(--Color-Scheme-1-Text,#000)]">
          {label} Password
        </label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={rolePasswords[role] || ""}
            onChange={(e) => handlePasswordChange(role, e.target.value)}
            placeholder={
              isConfigured
                ? `Replace ${label.toLowerCase()} password`
                : `Set ${label.toLowerCase()} password`
            }
            aria-label={`${label} password`}
            minLength={minLength}
            maxLength={ROLE_PASSWORD_MAX_LENGTH}
            disabled={isArchived}
            className="flex-1 min-w-0 rounded-[12px]"
          />
          <Button
            onClick={() => handleSetPassword(role)}
            disabled={isLoading || !rolePasswords[role] || isArchived}
            variant="outline"
            className="shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 rounded-[12px] bg-[var(--Color-Jacksons-Purple,#4B89EF)] text-white hover:bg-[#3E7EEA] border-0"
            style={{
              boxShadow:
                "0 32px 24px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px var(--Opacity-Neutral-Darkest-15, rgba(0, 0, 0, 0.15)) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.2) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0, 0, 0, 0.05))",
            }}
          >
            Save
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {configuredRoles === null ? null : isConfigured ? (
            <>
              <span className="font-medium text-green-700" data-testid={`role-password-status-${role}`}>
                Password set
              </span>
              <span aria-hidden="true">•</span>
              <button
                type="button"
                className="underline disabled:opacity-50"
                onClick={() => handleRemovePassword(role)}
                disabled={isLoading || isArchived}
              >
                Remove
              </button>
            </>
          ) : (
            <span data-testid={`role-password-status-${role}`}>No password set</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          This password will be used by {label.toLowerCase()}s to join the
          event. Use at least {minLength} characters.
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-6 p-5 rounded-[var(--Radius-Large,16px)] bg-card border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))]">
        <h3
          className="font-geist font-semibold leading-[140%] text-[var(--Color-Scheme-1-Text,#000)]"
          style={{
            fontSize: "var(--Text-Sizes-Heading-6, 22px)",
            letterSpacing: "-1.32px",
          }}
        >
          Role Passwords
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
          <div className="space-y-6">
            {leftColumnRoles.map(renderRoleField)}
          </div>
          <div className="space-y-6">
            {rightColumnRoles.map(renderRoleField)}
          </div>
        </div>
      </div>
    </div>
  );
}
