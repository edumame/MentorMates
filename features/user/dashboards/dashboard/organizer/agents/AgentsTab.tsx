"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import type { AgentsGetMany, AgentGetOne } from "@/modules/agents/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AgentTypeLabel from "@/components/ui/agent-type-label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/hooks/use-toast";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { UpdateAgentDialog } from "@/modules/agents/ui/components/update-agent-dialog";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { ResponsiveDialog } from "@/components/responsive-dialog";

interface AgentsTabProps {
  eventId?: string;
}

interface EventOption {
  event_id: string;
  event_name: string;
}

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
      new Map<string, string>(events.map((event) => [event.event_id, event.event_name])),
    [events]
  );

  const allOwnedAgents = useMemo(() => {
    const items = (agentsQuery.data?.items || []) as AgentsGetMany;
    return items.filter(
      (agent: AgentGetOne) =>
        String(agent.user_id ?? "") === String(session?.user?.id ?? "")
    );
  }, [agentsQuery.data, session?.user?.id]);

  const ownedAgents = useMemo(() => {
    if (!eventId) return allOwnedAgents;
    return allOwnedAgents.filter(
      (agent: AgentGetOne) =>
        String(agent.event_id ?? "") === String(eventId)
    );
  }, [allOwnedAgents, eventId]);

  const filteredOwnedAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ownedAgents;
    return ownedAgents.filter((agent: AgentGetOne) => {
      const name = normalizeText(agent.name).toLowerCase();
      const instructions = normalizeText(agent.instructions).toLowerCase();
      const type = normalizeText(agent.type).toLowerCase();
      return (
        name.includes(q) ||
        instructions.includes(q) ||
        type.includes(q)
      );
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
    `The following action will remove any associated conversations`,
  )

  const handleRemoveAgent = async (id: string) => {
    const ok = await confirmRemove();
    if (!ok) return;

    await removeAgent.mutateAsync({ id });
  };

  const toggleScoring = (agent: AgentGetOne, scoring: boolean) => {
    void (async () => {
      const t = toast({ title: scoring ? "Enabling scoring..." : "Disabling scoring...", description: String(agent.name), duration: 3000 });
      await updateAgent.mutateAsync({ id: agent.id, scoring });
      t.dismiss();
    })();
  };

  const enableAgent = (agent: AgentGetOne, enabled: boolean) => {
    void (async () => {
      const t = toast({ title: enabled ? "Enabling agent..." : "Disabling agent...", description: String(agent.name), duration: 3000 });
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
    if (!hasApplySelectionChanges) {
      return;
    }

    const signature = getAgentSignature(applyAgent);
    const name = normalizeText(applyAgent.name);
    const instructions = normalizeText(applyAgent.instructions);
    const type = normalizeText(applyAgent.type) || "brainstorm";
    if (!name || !instructions) {
      toast({
        title: "Cannot apply agent",
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

      const byEvent = signatureToAgentsByEvent.get(signature) || new Map<string, AgentGetOne[]>();

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
        const sameEvent =
          String(applyAgent.event_id ?? "") === String(targetEventId);
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
        title: "Apply complete",
        description: parts.length > 0 ? parts.join(" | ") : "No changes made",
      });

      if (failedCount === 0) {
        setApplyDialogOpen(false);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-2 justify-between">
        <input
          placeholder="Search agents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-2 py-1 flex-1"
        />
        <div className="ml-3">
          <Button onClick={() => setDialogOpen(true)}>Add agent</Button>
        </div>
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
        title="Apply agent to events"
        description="Check to apply, uncheck to remove. Already applied events are listed first."
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
      >
        <div className="space-y-3">
          <input
            placeholder="Search events"
            value={applySearch}
            onChange={(e) => setApplySearch(e.target.value)}
            className="w-full border rounded px-2 py-1"
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
                      <span className="text-xs text-gray-500">already applied</span>
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
              {isApplying ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <div className="space-y-3">
        {filteredOwnedAgents.map((agent: AgentGetOne) => {
          const signature = getAgentSignature(agent);
          const appliedEventIds = Array.from(signatureToEventIds.get(signature) || []);
          const appliedEventNames = appliedEventIds
            .map((id) =>
              eventNameById.get(String(id)) || `Event ${String(id).slice(0, 8)}`
            )
            .sort((a, b) => a.localeCompare(b));
          const eventName =
            appliedEventNames.length > 0
              ? appliedEventNames.join(", ")
              : agent.event_id == null
                ? "Global (all events)"
                : eventNameById.get(String(agent.event_id)) ||
                  `Event ${String(agent.event_id).slice(0, 8)}`;
          return (
            <div key={agent.id} className="flex items-center justify-between border p-3 rounded">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{agent.name}</span>
                  <AgentTypeLabel type={agent.type} />
                </div>
                <div className="text-sm text-gray-600">{agent.instructions}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Applied to events: {eventName}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm">Enable</span>
                  <Switch
                    aria-label={agent.enabled ? "Disable agent" : "Enable agent"}
                    checked={Boolean(agent.enabled)}
                    onCheckedChange={(e) => enableAgent(agent, e as boolean)}
                  />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm">Scoring</span>
                  <Switch
                    aria-label={agent.scoring === false ? "Enable scoring" : "Disable scoring"}
                    checked={Boolean(agent.scoring ?? true)}
                    onCheckedChange={(e) => toggleScoring(agent, e as boolean)}
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openApplyDialog(agent)}
                >
                  Apply
                </Button>
                <Button onClick={() => {
                  setSelectedAgent(agent);
                  setUpdateDialogOpen(true);
                }}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => handleRemoveAgent(agent.id)}>Delete</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AgentsTab;
