"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import type { AgentGetOne } from "@/modules/agents/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AgentTypeLabel from "@/components/ui/agent-type-label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/lib/hooks/use-toast";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { UpdateAgentDialog } from "@/modules/agents/ui/components/update-agent-dialog";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Bot, ChevronDown, ChevronUp, MessageSquare, Mic } from "lucide-react";

interface AgentsTabProps {
  eventId?: string;
}

interface EventOption {
  event_id: string;
  event_name: string;
}

const PROMPT_PREVIEW_LIMIT = 240;
const FEEDBACK_PREVIEW_LIMIT = 180;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getAgentSignature(agent: AgentGetOne): string {
  const name = normalizeText(agent.name).toLowerCase();
  const type = normalizeText(agent.type).toLowerCase();
  const instructions = normalizeText(agent.instructions);
  const feedbackPrompt = normalizeText(agent.feedback_prompt);
  return `${name}::${type}::${instructions}::${feedbackPrompt}`;
}

function normalizeOptionalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatVoiceLabel(value: unknown): string {
  const voice = cleanText(value);
  if (!voice) return "Default";
  if (voice.startsWith("voice_")) return "Custom Voice";
  return voice.charAt(0).toUpperCase() + voice.slice(1);
}

export function AgentsTab({ eventId }: AgentsTabProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentGetOne | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyAgent, setApplyAgent] = useState<AgentGetOne | null>(null);
  const [alreadyAppliedEventIds, setAlreadyAppliedEventIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [applySearch, setApplySearch] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});

  const agentsQuery = useQuery(
    trpc.agents.getMany.queryOptions({ pageSize: 100 })
  );

  useEffect(() => {
    const fetchEvents = async () => {
      if (!session?.user?.id) {
        setEvents([]);
        return;
      }

      try {
        const { data: userRoles, error } = await supabase
          .from("user_event_roles")
          .select("event_id, events:event_id (event_id, event_name)")
          .eq("user_id", session.user.id);

        if (error) throw error;

        const eventOptions: EventOption[] = [];
        for (const role of userRoles || []) {
          const eventsData = role.events as unknown;
          let event: EventOption | null = null;

          if (Array.isArray(eventsData) && eventsData.length > 0) {
            event = eventsData[0] as EventOption;
          } else if (
            eventsData &&
            typeof eventsData === "object" &&
            "event_id" in eventsData
          ) {
            event = eventsData as EventOption;
          }

          if (event?.event_id) {
            eventOptions.push({
              event_id: event.event_id,
              event_name: event.event_name || "Untitled event",
            });
          }
        }

        const deduped = Array.from(
          new Map(eventOptions.map((e) => [e.event_id, e])).values()
        ).sort((a, b) => a.event_name.localeCompare(b.event_name));
        setEvents(deduped);
      } catch (error) {
        console.error("Error fetching events for agents:", error);
        setEvents([]);
      }
    };

    fetchEvents();
  }, [session?.user?.id]);

  const eventNameById = useMemo(
    () =>
      new Map<string, string>(
        events.map((event) => [event.event_id, event.event_name])
      ),
    [events]
  );

  const allOwnedAgents = useMemo<AgentGetOne[]>(() => {
    const items = ((agentsQuery.data?.items || []) as unknown[]) as AgentGetOne[];
    return items.filter(
      (agent: AgentGetOne) =>
        String(agent.user_id ?? "") === String(session?.user?.id ?? "")
    );
  }, [agentsQuery.data, session?.user?.id]);

  const ownedAgents = useMemo<AgentGetOne[]>(() => {
    if (!eventId) return allOwnedAgents;
    return allOwnedAgents.filter(
      (agent: AgentGetOne) => String(agent.event_id ?? "") === String(eventId)
    );
  }, [allOwnedAgents, eventId]);

  const filteredOwnedAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ownedAgents;
    return ownedAgents.filter((agent: AgentGetOne) => {
      const name = normalizeText(agent.name).toLowerCase();
      const instructions = normalizeText(agent.instructions).toLowerCase();
      const type = normalizeText(agent.type).toLowerCase();
      return name.includes(q) || instructions.includes(q) || type.includes(q);
    });
  }, [ownedAgents, search]);

  const existingAgentKeys = useMemo(
    () =>
      new Set(
        allOwnedAgents.map(
          (agent: AgentGetOne) =>
            `${String(agent.event_id ?? "")}::${getAgentSignature(agent)}`
        )
      ),
    [allOwnedAgents]
  );

  const signatureToEventIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const agent of allOwnedAgents) {
      const signature = getAgentSignature(agent);
      const eventIdValue = normalizeText(agent.event_id);
      const set = map.get(signature) || new Set<string>();
      if (eventIdValue) set.add(eventIdValue);
      map.set(signature, set);
    }
    return map;
  }, [allOwnedAgents]);

  const signatureToAgentsByEvent = useMemo(() => {
    const map = new Map<string, Map<string, AgentGetOne[]>>();
    for (const agent of allOwnedAgents) {
      const signature = getAgentSignature(agent);
      const eventIdValue = normalizeText(agent.event_id);
      if (!eventIdValue) continue;

      const byEvent = map.get(signature) || new Map<string, AgentGetOne[]>();
      const rows = byEvent.get(eventIdValue) || [];
      rows.push(agent);
      byEvent.set(eventIdValue, rows);
      map.set(signature, byEvent);
    }
    return map;
  }, [allOwnedAgents]);

  const hasApplySelectionChanges = useMemo(() => {
    if (!applyDialogOpen) return false;
    const current = new Set(alreadyAppliedEventIds);
    const next = new Set(selectedEventIds);
    if (current.size !== next.size) return true;
    for (const id of current) {
      if (!next.has(id)) return true;
    }
    return false;
  }, [applyDialogOpen, alreadyAppliedEventIds, selectedEventIds]);

  const applyDialogEvents = useMemo(() => {
    const q = applySearch.trim().toLowerCase();
    const filtered = !q
      ? [...events]
      : events.filter((event) => event.event_name.toLowerCase().includes(q));

    return filtered.sort((a, b) => {
      const aApplied = alreadyAppliedEventIds.includes(a.event_id) ? 1 : 0;
      const bApplied = alreadyAppliedEventIds.includes(b.event_id) ? 1 : 0;
      if (aApplied !== bApplied) return bApplied - aApplied;
      return a.event_name.localeCompare(b.event_name);
    });
  }, [events, applySearch, alreadyAppliedEventIds]);

  const createAgent = useMutation(
    trpc.agents.create.mutationOptions({
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    })
  );

  const updateAgent = useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.agents.getMany.queryOptions({ pageSize: 100 })
        );
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    })
  );

  const removeAgent = useMutation(
    trpc.agents.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    })
  );

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure?",
    "The following action will remove any associated conversations"
  );

  const handleRemoveAgent = async (id: string) => {
    const ok = await confirmRemove();
    if (!ok) return;

    await removeAgent.mutateAsync({ id });
  };

  const toggleScoring = (agent: AgentGetOne, scoring: boolean) => {
    void (async () => {
      const t = toast({
        title: scoring ? "Enabling scoring..." : "Disabling scoring...",
        description: String(agent.name),
        duration: 3000,
      });
      await updateAgent.mutateAsync({ id: agent.id, scoring });
      t.dismiss();
    })();
  };

  const enableAgent = (agent: AgentGetOne, enabled: boolean) => {
    void (async () => {
      const t = toast({
        title: enabled ? "Enabling agent..." : "Disabling agent...",
        description: String(agent.name),
        duration: 3000,
      });
      await updateAgent.mutateAsync({ id: agent.id, enabled });
      t.dismiss();
    })();
  };

  const openApplyDialog = (agent: AgentGetOne) => {
    const signature = getAgentSignature(agent);
    const applied = Array.from(signatureToEventIds.get(signature) || []);
    setApplyAgent(agent);
    setAlreadyAppliedEventIds(applied);
    setSelectedEventIds(applied);
    setApplySearch("");
    setApplyDialogOpen(true);
  };

  const toggleTargetEvent = (targetId: string, checked: boolean) => {
    setSelectedEventIds((prev) => {
      if (checked) {
        if (prev.includes(targetId)) return prev;
        return [...prev, targetId];
      }
      return prev.filter((id) => id !== targetId);
    });
  };

  const applyAgentToEvents = async () => {
    if (!applyAgent) return;
    if (!hasApplySelectionChanges) return;

    const signature = getAgentSignature(applyAgent);
    const name = normalizeText(applyAgent.name);
    const instructions = normalizeText(applyAgent.instructions);
    const type = normalizeText(applyAgent.type) || "brainstorm";

    if (!name || !instructions) {
      toast({
        title: "Cannot update availability",
        description: "This agent is missing a required name or instructions.",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    let createdCount = 0;
    let removedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const currentSet = new Set(alreadyAppliedEventIds);
      const nextSet = new Set(selectedEventIds);
      const toRemove = Array.from(currentSet).filter((id) => !nextSet.has(id));
      const toAdd = Array.from(nextSet).filter((id) => !currentSet.has(id));

      const byEvent =
        signatureToAgentsByEvent.get(signature) || new Map<string, AgentGetOne[]>();

      for (const targetEventId of toRemove) {
        const rows = byEvent.get(targetEventId) || [];
        if (rows.length === 0) {
          skippedCount += 1;
          continue;
        }

        try {
          for (const row of rows) {
            await removeAgent.mutateAsync({ id: row.id });
          }
          removedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      for (const targetEventId of toAdd) {
        const sameEvent = String(applyAgent.event_id ?? "") === String(targetEventId);
        const key = `${targetEventId}::${signature}`;
        if (sameEvent || existingAgentKeys.has(key)) {
          skippedCount += 1;
          continue;
        }

        try {
          await createAgent.mutateAsync({
            name,
            instructions,
            type,
            event_id: targetEventId,
            enabled: Boolean(applyAgent.enabled ?? true),
            scoring: Boolean(applyAgent.scoring ?? true),
            avatar_url: normalizeOptionalUrl(applyAgent.avatar_url),
            feedback_prompt: normalizeOptionalText(applyAgent.feedback_prompt),
            voice: normalizeOptionalText(applyAgent.voice),
          });
          createdCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));

      const parts = [
        createdCount > 0 ? `${createdCount} created` : null,
        removedCount > 0 ? `${removedCount} removed` : null,
        skippedCount > 0 ? `${skippedCount} skipped` : null,
        failedCount > 0 ? `${failedCount} failed` : null,
      ].filter(Boolean);

      toast({
        title: "Availability updated",
        description: parts.length > 0 ? parts.join(" | ") : "No changes made",
      });

      if (failedCount === 0) {
        setApplyDialogOpen(false);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const togglePromptPreview = (agentId: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">Agents</h2>
          <p className="text-sm text-muted-foreground">
            Assign focused AI personas for your event without exposing full prompts by default.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          Add agent
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search agents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10"
        />
      </div>

      <NewAgentDialog open={dialogOpen} onOpenChange={setDialogOpen} eventId={eventId} />

      {selectedAgent && (
        <UpdateAgentDialog
          open={updateDialogOpen}
          onOpenChange={(open: boolean) => {
            setUpdateDialogOpen(open);
          }}
          initialValues={selectedAgent}
        />
      )}

      <RemoveConfirmation />

      <ResponsiveDialog
        title="Manage agent availability"
        description="Select the events where participants can access this agent. Uncheck to remove access."
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
      >
        <div className="space-y-3">
          <Input
            placeholder="Search events"
            value={applySearch}
            onChange={(e) => setApplySearch(e.target.value)}
            className="h-9"
          />

          {events.length === 0 ? (
            <p className="text-sm text-gray-600">No events available.</p>
          ) : applyDialogEvents.length === 0 ? (
            <p className="text-sm text-gray-600">No events match your search.</p>
          ) : (
            <div className="max-h-72 overflow-auto space-y-2 rounded border p-3">
              {applyDialogEvents.map((event) => {
                const alreadyExists = alreadyAppliedEventIds.includes(event.event_id);
                return (
                  <label
                    key={event.event_id}
                    className="flex items-center justify-between gap-2 rounded p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedEventIds.includes(event.event_id)}
                        disabled={isApplying}
                        onCheckedChange={(checked) =>
                          toggleTargetEvent(event.event_id, Boolean(checked))
                        }
                      />
                      <span className="text-sm">{event.event_name}</span>
                    </div>
                    {alreadyExists && (
                      <span className="text-xs text-gray-500">currently available</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setApplyDialogOpen(false)}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyAgentToEvents}
              disabled={isApplying || !hasApplySelectionChanges}
            >
              {isApplying ? "Saving..." : "Save access"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <div className="space-y-4">
        {filteredOwnedAgents.map((agent: AgentGetOne) => {
          const signature = getAgentSignature(agent);
          const appliedEventIds = Array.from(signatureToEventIds.get(signature) || []);
          const appliedEventNames = appliedEventIds
            .map((id) => eventNameById.get(String(id)) || `Event ${String(id).slice(0, 8)}`)
            .sort((a, b) => a.localeCompare(b));
          const appliedEventsLabel =
            appliedEventNames.length > 0
              ? appliedEventNames.join(", ")
              : agent.event_id == null
                ? "Global (all events)"
                : eventNameById.get(String(agent.event_id)) ||
                  `Event ${String(agent.event_id).slice(0, 8)}`;

          const instructions = cleanText(agent.instructions);
          const feedbackPrompt = cleanText(agent.feedback_prompt);
          const isExpanded = Boolean(expandedPrompts[agent.id]);
          const hasLongPrompt = instructions.length > PROMPT_PREVIEW_LIMIT;
          const visiblePrompt = isExpanded
            ? instructions
            : truncateText(instructions, PROMPT_PREVIEW_LIMIT);
          const visibleFeedback = truncateText(feedbackPrompt, FEEDBACK_PREVIEW_LIMIT);
          const meetingCount = Number(
            (agent as AgentGetOne & { meetingCount?: number }).meetingCount ?? 0
          );
          const hasAvatar = cleanText(agent.avatar_url).length > 0;

          return (
            <article
              key={agent.id}
              className="rounded-[14px] border border-[rgba(75,137,239,0.35)] bg-[#f7fbff] p-4 shadow-sm sm:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[220px_1fr_280px]">
                <section className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white p-4 text-center">
                  <Avatar className="mx-auto h-16 w-16 border border-[rgba(0,0,0,0.15)]">
                    {hasAvatar && (
                      <AvatarImage src={String(agent.avatar_url)} alt={String(agent.name)} />
                    )}
                    <AvatarFallback className="bg-[#eaf2ff] text-[#2f61b3] text-lg font-semibold">
                      {getInitials(String(agent.name))}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="mt-3 text-base font-semibold text-black">{agent.name}</h3>
                  <div className="mt-2 flex justify-center">
                    <AgentTypeLabel type={agent.type} />
                  </div>

                  {!agent.enabled && (
                    <p className="mt-2 text-xs font-medium text-gray-500">Paused</p>
                  )}

                  <p className="mt-3 text-xs text-gray-500">Available in</p>
                  <p className="line-clamp-3 text-sm text-gray-700">{appliedEventsLabel}</p>
                </section>

                <section className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs text-[#305f99]">
                      <Bot className="h-3.5 w-3.5" />
                      Persona
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs text-[#305f99]">
                      <Mic className="h-3.5 w-3.5" />
                      {formatVoiceLabel(agent.voice)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs text-[#305f99]">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {meetingCount} {meetingCount === 1 ? "session" : "sessions"}
                    </span>
                  </div>

                  <div className="rounded-lg border border-[rgba(0,0,0,0.1)] bg-[#fbfdff] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Instructions
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">
                      {visiblePrompt || "No persona instructions yet."}
                    </p>

                    {hasLongPrompt && (
                      <button
                        type="button"
                        onClick={() => togglePromptPreview(agent.id)}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#4b89ef] hover:text-[#3f7bd8]"
                      >
                        {isExpanded ? (
                          <>
                            Hide full prompt
                            <ChevronUp className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Show full prompt
                            <ChevronDown className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {feedbackPrompt && (
                    <div className="mt-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Feedback behavior
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{visibleFeedback}</p>
                    </div>
                  )}
                </section>

                <aside className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Live controls
                  </p>

                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-[rgba(0,0,0,0.1)] px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-black">Enable agent</p>
                        <p className="text-xs text-gray-500">Can participants use it?</p>
                      </div>
                      <Switch
                        aria-label={agent.enabled ? "Disable agent" : "Enable agent"}
                        checked={Boolean(agent.enabled)}
                        onCheckedChange={(e) => enableAgent(agent, e as boolean)}
                        disabled={updateAgent.isPending}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[rgba(0,0,0,0.1)] px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-black">Scoring mode</p>
                        <p className="text-xs text-gray-500">Add numeric evaluations</p>
                      </div>
                      <Switch
                        aria-label={agent.scoring === false ? "Enable scoring" : "Disable scoring"}
                        checked={Boolean(agent.scoring ?? true)}
                        onCheckedChange={(e) => toggleScoring(agent, e as boolean)}
                        disabled={updateAgent.isPending}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openApplyDialog(agent)}
                      disabled={isApplying}
                    >
                      Event access
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setUpdateDialogOpen(true);
                      }}
                    >
                      Edit agent
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleRemoveAgent(agent.id)}
                      disabled={removeAgent.isPending}
                    >
                      Delete agent
                    </Button>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}

        {agentsQuery.isLoading && (
          <div className="rounded-[14px] border border-[rgba(0,0,0,0.15)] bg-white p-6 text-sm text-gray-500">
            Loading agents...
          </div>
        )}

        {!agentsQuery.isLoading && filteredOwnedAgents.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-[rgba(0,0,0,0.25)] bg-white p-8 text-center">
            <p className="text-base font-medium text-black">No agents found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!session?.user?.id
                ? "Sign in to view and manage agents."
                : search.trim().length > 0
                  ? "Try a different search or clear filters."
                  : "Create an agent to start assigning AI personas to your events."}
            </p>
            {session?.user?.id && search.trim().length === 0 && (
              <Button size="sm" onClick={() => setDialogOpen(true)} className="mt-4">
                Add your first agent
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentsTab;
