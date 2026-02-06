"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AgentTypeLabel from "@/components/ui/agent-type-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { EventDetails, EventRole } from "@/lib/types";
import { getRoleLabel } from "@/features/user/roles/roles";

type Agent = {
  id: string;
  name?: string | null;
  type?: string | null;
  enabled?: boolean | null;
};
type RoleAutoConversations = Partial<Record<EventRole, string[]>>;

const AUTO_CONVERSATION_ROLES: EventRole[] = [
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
  EventRole.Organizer,
];

interface SessionCaps {
  default: number | null;
  agent_caps: Record<string, number | null>;
  auto_conversations?: RoleAutoConversations;
}

interface SessionsTabProps {
  eventId: string;
  event?: EventDetails | null;
  setEvent?: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

const normalizeAutoConversations = (value: unknown): RoleAutoConversations => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const src = value as Record<string, unknown>;
  const out: RoleAutoConversations = {};

  for (const role of AUTO_CONVERSATION_ROLES) {
    const rawIds = src[role];
    if (!Array.isArray(rawIds)) continue;
    out[role] = Array.from(
      new Set(rawIds.filter((id) => typeof id === "string" && id.trim().length > 0))
    );
  }

  return out;
};

export function SessionsTab({ eventId, event, setEvent }: SessionsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Array<Agent>>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [defaultCap, setDefaultCap] = useState<number | null>(null);
  const [defaultUnlimited, setDefaultUnlimited] = useState(true);
  const [agentCaps, setAgentCaps] = useState<Record<string, number | null>>({});
  const [autoConversations, setAutoConversations] = useState<RoleAutoConversations>({});

  useEffect(() => {
    if (event && (event as EventDetails & { session_caps?: SessionCaps | null }).session_caps) {
      const cfg = (event as EventDetails & { session_caps?: SessionCaps | null }).session_caps;
      setDefaultCap(cfg?.default ?? null);
      setDefaultUnlimited(cfg?.default == null);
      setAgentCaps(cfg?.agent_caps || {});
      setAutoConversations(normalizeAutoConversations(cfg?.auto_conversations));
    } else {
      // Nothing passed in; try loading from events table
      loadEventConfig();
    }

    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEventConfig = async () => {
    try {
      const { data, error } = await supabase.from("events").select("session_caps").eq("event_id", eventId).single();
      if (error) throw error;
      const row = data as unknown as { session_caps?: SessionCaps | null } | null;
      const cfg = row?.session_caps ?? null;
      if (cfg) {
        setDefaultCap(cfg.default ?? null);
        setDefaultUnlimited(cfg.default == null);
        setAgentCaps(cfg.agent_caps || {});
        setAutoConversations(normalizeAutoConversations(cfg.auto_conversations));
      } else {
        setDefaultCap(null);
        setDefaultUnlimited(true);
        setAgentCaps({});
        setAutoConversations({});
      }
    } catch (err) {
      console.error("Failed to load session config", err, JSON.stringify(err));
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to load session config", description: message || "See console for details", variant: "destructive" });
    }
  };

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("id,name,type,enabled")
        .eq("event_id", eventId)
        .order("name", { ascending: true });
      if (error) throw error;
      setAgents((data || []).filter((agent) => agent.enabled !== false));
    } catch (err) {
      console.error("Failed to load agents", err);
    }
    finally {
      setAgentsLoaded(true);
    }
  };

  const updateAgentCap = (agentId: string, value: string) => {
    const val = value === "" ? null : Math.max(0, Number(value));
    setAgentCaps((prev) => ({ ...prev, [agentId]: val }));
  };

  const updateAutoConversationAgent = (role: EventRole, agentId: string, enabled: boolean) => {
    setAutoConversations((prev) => {
      const current = new Set(prev[role] || []);
      if (enabled) {
        current.add(agentId);
      } else {
        current.delete(agentId);
      }

      const nextRoleValues = Array.from(current);
      if (nextRoleValues.length === 0) {
        const rest = { ...prev };
        delete rest[role];
        return rest;
      }

      return { ...prev, [role]: nextRoleValues };
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const sanitizedAutoConversations = AUTO_CONVERSATION_ROLES.reduce(
        (acc, role) => {
          const ids = Array.from(new Set((autoConversations[role] || []).filter(Boolean)));
          if (ids.length > 0) acc[role] = ids;
          return acc;
        },
        {} as RoleAutoConversations
      );

      const payload = {
        default: defaultUnlimited ? null : defaultCap,
        agent_caps: agentCaps,
        auto_conversations: sanitizedAutoConversations,
      };

      const { data, error } = await supabase
        .from("events")
        .update({ session_caps: payload })
        .eq("event_id", eventId)
        .select()
        .single();

      if (error) throw error;

      if (setEvent) setEvent(data);

      toast({ title: "Saved", description: "Session caps updated" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to save session caps", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Configure Sessions</h2>

      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">Default cap per user (per event)</label>
        <div className="flex items-center gap-3">
            <Input
            type="number"
            value={defaultUnlimited ? "" : (defaultCap ?? "")}
            onChange={(e) => {
              setDefaultUnlimited(false);
              const v = e.target.value;
              setDefaultCap(v === "" ? null : Math.max(0, Number(v)));
            }}
            placeholder="e.g. 2"
            className="w-32"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={defaultUnlimited}
              onChange={(e) => {
                setDefaultUnlimited(e.target.checked);
                if (e.target.checked) setDefaultCap(null);
              }}
            />
            <span>Unlimited</span>
          </label>
        </div>
        <p className="text-sm text-muted-foreground mt-2">If set to &quot;Unlimited&quot; there is no numeric cap for default agent sessions.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-2">Per-agent caps</h3>
        <p className="text-sm text-muted-foreground mb-4">Set overrides for specific agents (leave blank for default).</p>

        {agentsLoaded && agents.length === 0 ? (
          <div className="p-4 rounded border bg-yellow-50">
            <p className="text-sm text-muted-foreground">No agents found for this event. Create agents in the Agents tab to configure per-agent caps.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <span>{a.name || a.id}</span>
                  <AgentTypeLabel type={a.type ?? ""} />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    value={agentCaps[a.id] ?? ""}
                    onChange={(e) => updateAgentCap(a.id, e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="font-medium mb-2">Auto-create TODO conversations on join</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which agents should be pre-created as conversations when a user joins this event with a given role.
        </p>

        {agentsLoaded && agents.length === 0 ? (
          <div className="p-4 rounded border bg-yellow-50">
            <p className="text-sm text-muted-foreground">
              No agents found for this event. Create agents in the Agents tab to configure auto conversations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {AUTO_CONVERSATION_ROLES.map((role) => (
              <div key={role} className="rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {getRoleLabel(role, event?.role_labels ?? null)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(autoConversations[role] || []).length} selected
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {agents.map((agent) => {
                    const checked = (autoConversations[role] || []).includes(agent.id);
                    return (
                      <label
                        key={`${role}-${agent.id}`}
                        className="flex items-center gap-2 rounded border px-2 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            updateAutoConversationAgent(role, agent.id, e.target.checked)
                          }
                        />
                        <span className="flex flex-1 items-center gap-2 truncate">
                          <span className="truncate">{agent.name || agent.id}</span>
                          <AgentTypeLabel type={agent.type ?? ""} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            loadEventConfig();
            toast({ title: "Reverted", description: "Reverted to saved configuration" });
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

export default SessionsTab;
