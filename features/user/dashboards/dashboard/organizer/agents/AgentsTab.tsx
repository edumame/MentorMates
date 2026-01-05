"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/hooks/use-toast";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { UpdateAgentDialog } from "@/modules/agents/ui/components/update-agent-dialog";
import { useConfirm } from "@/lib/hooks/use-confirm";

interface AgentsTabProps {
  eventId: string;
}

export function AgentsTab({ eventId }: AgentsTabProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const agentsQuery = useQuery(trpc.agents.getMany.queryOptions({ pageSize: 100, search }));

  const updateAgent = useMutation(trpc.agents.update.mutationOptions({
    onSuccess: async () => {
      await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({ pageSize: 100 }));
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  }));

  const removeAgent = useMutation(trpc.agents.remove.mutationOptions({
    onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
    },
    onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  }));

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure?",
    `The following action will remove any associated conversations`,
  )

  const handleRemoveAgent = async (id: string) => {
    const ok = await confirmRemove();
    if (!ok) return;

    await removeAgent.mutateAsync({ id });
  };

  useEffect(() => {}, [eventId]);

  const enableAgent = (agent: any, enabled: boolean) => {
    void (async () => {
      const t = toast({ title: enabled ? "Enabling agent..." : "Disabling agent...", description: agent.name, duration: 3000 });
      await updateAgent.mutateAsync({ id: agent.id, enabled });
      t.dismiss();
    })();
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

      <div className="space-y-3">
        {(agentsQuery.data?.items || []).map((agent: any) => {
          return (
            <div key={agent.id} className="flex items-center justify-between border p-3 rounded">
              <div>
                <div className="font-medium">{agent.name}</div>
                <div className="text-sm text-gray-600">{agent.instructions}</div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={agent.enabled} onCheckedChange={(e) => enableAgent(agent, e)} />
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