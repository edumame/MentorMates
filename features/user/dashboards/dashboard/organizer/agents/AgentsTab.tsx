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
  const [targetEventIds, setTargetEventIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [search, setSearch] = useState("");

  const agentsQuery = useQuery(
    trpc.agents.getMany.queryOptions({ pageSize: 100, search })
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

  const existingAgentKeys = useMemo(
    () =>
      new Set(
        allOwnedAgents.map(
          (agent: AgentGetOne) =>
            `${String(agent.event_id ?? "")}::${String(agent.name ?? "")
              .trim()
              .toLowerCase()}`
        )
      ),
    [allOwnedAgents]
  );

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
    setApplyAgent(agent);
    setTargetEventIds([]);
    setApplyDialogOpen(true);
  };

  const toggleTargetEvent = (targetId: string, checked: boolean) => {
    setTargetEventIds((prev) => {
      if (checked) {
        if (prev.includes(targetId)) return prev;
        return [...prev, targetId];
      }
      return prev.filter((id) => id !== targetId);
    });
  };

  const applyAgentToEvents = async () => {
    if (!applyAgent) return;
    if (targetEventIds.length === 0) {
      toast({
        title: "No events selected",
        description: "Choose at least one event.",
        variant: "destructive",
      });
      return;
    }

    const name = String(applyAgent.name ?? "").trim();
    const instructions = String(applyAgent.instructions ?? "").trim();
    const type = String(applyAgent.type ?? "brainstorm").trim() || "brainstorm";
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
    let skippedCount = 0;
    let failedCount = 0;

    try {
      for (const targetEventId of targetEventIds) {
        const sameEvent =
          String(applyAgent.event_id ?? "") === String(targetEventId);
        const key = `${targetEventId}::${name.toLowerCase()}`;
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
        skippedCount > 0 ? `${skippedCount} skipped` : null,
        failedCount > 0 ? `${failedCount} failed` : null,
      ].filter(Boolean);

      toast({
        title: "Apply complete",
        description: parts.length > 0 ? parts.join(" | ") : "No changes made",
      });

      if (createdCount > 0) {
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
        description="This creates copies of the current agent in the selected events."
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
      >
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-gray-600">No events available.</p>
          ) : (
            <div className="max-h-72 overflow-auto space-y-2 rounded border p-3">
              {events.map((event) => {
                const isCurrentEvent =
                  String(applyAgent?.event_id ?? "") === String(event.event_id);
                const nameKey = String(applyAgent?.name ?? "").trim().toLowerCase();
                const alreadyExists = existingAgentKeys.has(
                  `${event.event_id}::${nameKey}`
                );
                const disabled = isCurrentEvent || alreadyExists;
                return (
                  <label
                    key={event.event_id}
                    className={`flex items-center justify-between gap-2 rounded p-2 ${
                      disabled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={targetEventIds.includes(event.event_id)}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          toggleTargetEvent(event.event_id, Boolean(checked))
                        }
                      />
                      <span className="text-sm">{event.event_name}</span>
                    </div>
                    {isCurrentEvent && (
                      <span className="text-xs text-gray-500">current</span>
                    )}
                    {!isCurrentEvent && alreadyExists && (
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
              disabled={isApplying || targetEventIds.length === 0}
            >
              {isApplying ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <div className="space-y-3">
        {ownedAgents.map((agent: AgentGetOne) => {
          const eventName =
            agent.event_id == null
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
                  Applied to: {eventName}
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
