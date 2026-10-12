import { z } from "zod";

export const DEFAULT_ORGANIZER_AGENT_SCOPES = [
  "event:read",
  "event:write",
  "participants:read",
  "participants:write",
  "projects:read",
  "projects:write",
] as const;

export const DEFAULT_PARTICIPANT_AGENT_SCOPES = [
  "participant-events:read",
  "participant-events:join",
  "participant-projects:read",
  "participant-projects:write",
] as const;

export const ALL_AGENT_SCOPES = [
  ...DEFAULT_ORGANIZER_AGENT_SCOPES,
  ...DEFAULT_PARTICIPANT_AGENT_SCOPES,
] as const;

export type AgentScope = (typeof ALL_AGENT_SCOPES)[number];
export type AgentAccessMode = "organizer" | "participant";
export type AgentScopeMode = "public" | "event";

export const agentAccessModeSchema = z.enum(["organizer", "participant"]);
export const agentScopeModeSchema = z.enum(["public", "event"]);
export const agentScopeSchema = z.enum(ALL_AGENT_SCOPES);

const ORGANIZER_SCOPE_SET = new Set<AgentScope>(DEFAULT_ORGANIZER_AGENT_SCOPES);
const PARTICIPANT_SCOPE_SET = new Set<AgentScope>(DEFAULT_PARTICIPANT_AGENT_SCOPES);

export function getDefaultScopesForAccessMode(
  accessMode: AgentAccessMode
): AgentScope[] {
  return accessMode === "organizer"
    ? [...DEFAULT_ORGANIZER_AGENT_SCOPES]
    : [...DEFAULT_PARTICIPANT_AGENT_SCOPES];
}

export function getAllowedScopesForAccessMode(
  accessMode: AgentAccessMode
): Set<AgentScope> {
  return accessMode === "organizer"
    ? ORGANIZER_SCOPE_SET
    : PARTICIPANT_SCOPE_SET;
}

export function areScopesAllowedForAccessMode(
  accessMode: AgentAccessMode,
  scopes: string[]
): scopes is AgentScope[] {
  const allowed = getAllowedScopesForAccessMode(accessMode);
  return scopes.every(
    (scope): scope is AgentScope =>
      agentScopeSchema.safeParse(scope).success && allowed.has(scope as AgentScope)
  );
}

export function inferAgentAccessModeFromScopes(
  scopes: string[] | null | undefined
): AgentAccessMode {
  if ((scopes || []).some((scope) => ORGANIZER_SCOPE_SET.has(scope as AgentScope))) {
    return "organizer";
  }

  return "participant";
}
