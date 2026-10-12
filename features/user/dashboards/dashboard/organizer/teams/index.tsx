"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/lib/hooks/use-toast";
import { Loader2, Users } from "lucide-react";
import { EventDetails } from "@/lib/types";
import { TeamWithMembers } from "@/lib/types/team";
import {
  createTeam,
  deleteTeamOrMember,
  fetchParticipants,
  fetchTeams,
  patchTeam,
  RosterUser,
} from "@/features/teams/api/teamsClient";
import { TeamMemberRow } from "@/features/teams/components/TeamMemberRow";
import { TeammatePicker } from "@/features/teams/components/TeammatePicker";

interface OrganizerTeamsTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

export function OrganizerTeamsTab({
  eventId,
  event,
  setEvent,
}: OrganizerTeamsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [participants, setParticipants] = useState<RosterUser[]>([]);

  // Create-team form.
  const [newName, setNewName] = useState("");
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);
  // Per-team add-member selections, keyed by team id.
  const [addByTeam, setAddByTeam] = useState<Record<string, string[]>>({});

  const enabled = Boolean(event.team_formation_enabled);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ teams: all }, roster] = await Promise.all([
        fetchTeams(eventId),
        fetchParticipants(eventId),
      ]);
      setTeams(all);
      setParticipants(roster);
    } catch (err) {
      toast({
        title: "Couldn't load teams",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // User ids that already belong to some team — excluded from all pickers.
  const assignedIds = useMemo(
    () => teams.flatMap((t) => t.members.map((m) => m.user_id)),
    [teams]
  );

  const handleToggle = async (value: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ team_formation_enabled: value })
        .eq("event_id", eventId);
      if (error) throw error;
      setEvent((prev) =>
        prev ? { ...prev, team_formation_enabled: value } : prev
      );
      toast({
        title: value ? "Team formation enabled" : "Team formation disabled",
      });
    } catch (err) {
      toast({
        title: "Couldn't update setting",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: "Enter a team name", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await createTeam(eventId, {
        name: newName.trim(),
        memberUserIds: newMemberIds,
      });
      setNewName("");
      setNewMemberIds([]);
      await load();
      toast({ title: "Team created" });
    } catch (err) {
      toast({
        title: "Couldn't create team",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddMembers = async (teamId: string) => {
    const ids = addByTeam[teamId] ?? [];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await patchTeam(eventId, { teamId, addUserIds: ids });
      setAddByTeam((prev) => ({ ...prev, [teamId]: [] }));
      await load();
      toast({ title: "Members added" });
    } catch (err) {
      toast({
        title: "Couldn't add members",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (teamId: string, userId: string) => {
    setBusy(true);
    try {
      await deleteTeamOrMember(eventId, teamId, userId);
      await load();
      toast({ title: "Member removed" });
    } catch (err) {
      toast({
        title: "Couldn't remove member",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDissolve = async (teamId: string) => {
    setBusy(true);
    try {
      await deleteTeamOrMember(eventId, teamId);
      await load();
      toast({ title: "Team dissolved" });
    } catch (err) {
      toast({
        title: "Couldn't dissolve team",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleNewMember = (uid: string) =>
    setNewMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );

  const toggleAddMember = (teamId: string, uid: string) =>
    setAddByTeam((prev) => {
      const cur = prev[teamId] ?? [];
      return {
        ...prev,
        [teamId]: cur.includes(uid)
          ? cur.filter((x) => x !== uid)
          : [...cur, uid],
      };
    });

  return (
    <div className="mt-[24px] flex flex-col gap-6">
      {/* Feature toggle */}
      <Card className="bg-white">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex flex-col">
            <p className="font-medium text-[15px] text-black">
              Enable team formation
            </p>
            <p className="text-[13px] text-gray-500">
              Lets participants create and join teams from a Team tab.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={busy}
            aria-label="Enable team formation"
          />
        </CardContent>
      </Card>

      {/* Create a team on participants' behalf */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-[16px]">Create a team</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-team-name">Team name</Label>
            <Input
              id="org-team-name"
              placeholder="Team name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Members (first selected becomes the lead)</Label>
            <TeammatePicker
              candidates={participants}
              selectedIds={newMemberIds}
              onToggle={toggleNewMember}
              excludeIds={assignedIds}
              disabled={busy}
            />
          </div>
          <div>
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create team
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All teams */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-900" />
        </div>
      ) : teams.length === 0 ? (
        <p className="text-[15px] text-gray-500 py-6">No teams yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-medium text-gray-700">
            {teams.length} {teams.length === 1 ? "team" : "teams"}
          </p>
          {teams.map((team) => (
            <Card key={team.id} className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[16px] flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {team.name}
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDissolve(team.id)}
                  disabled={busy}
                >
                  Dissolve
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="divide-y divide-[rgba(0,0,0,0.06)]">
                  {team.members.length === 0 ? (
                    <p className="text-[14px] text-gray-500 py-2">
                      No members.
                    </p>
                  ) : (
                    team.members.map((m) => (
                      <TeamMemberRow
                        key={m.user_id}
                        member={m}
                        onRemove={(uid) => handleRemove(team.id, uid)}
                        removing={busy}
                      />
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Add members</Label>
                  <TeammatePicker
                    candidates={participants}
                    selectedIds={addByTeam[team.id] ?? []}
                    onToggle={(uid) => toggleAddMember(team.id, uid)}
                    excludeIds={assignedIds}
                    disabled={busy}
                  />
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddMembers(team.id)}
                      disabled={busy || (addByTeam[team.id] ?? []).length === 0}
                    >
                      Add selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
