"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { Loader2, Users } from "lucide-react";
import { TeamMemberRole, TeamWithMembers } from "@/lib/types/team";
import {
  createTeam,
  deleteTeamOrMember,
  fetchParticipants,
  fetchTeams,
  patchTeam,
  RosterUser,
} from "../api/teamsClient";
import { TeamMemberRow } from "./TeamMemberRow";
import { TeammatePicker } from "./TeammatePicker";

interface TeamFormationPanelProps {
  eventId: string;
}

interface LeadProject {
  id: string;
  project_name: string | null;
}

const NO_PROJECT = "__none__";

export function TeamFormationPanel({ eventId }: TeamFormationPanelProps) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [myTeam, setMyTeam] = useState<TeamWithMembers | null>(null);
  const [participants, setParticipants] = useState<RosterUser[]>([]);
  const [leadProjects, setLeadProjects] = useState<LeadProject[]>([]);

  // Create-team form state.
  const [teamName, setTeamName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Add-teammate state (existing team).
  const [addIds, setAddIds] = useState<string[]>([]);

  const isLead = useMemo(
    () => !!myTeam && !!userId && myTeam.created_by === userId,
    [myTeam, userId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ myTeam: team }, roster] = await Promise.all([
        fetchTeams(eventId),
        fetchParticipants(eventId),
      ]);
      setMyTeam(team);
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
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      const email = data.user?.email;
      if (email) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, project_name")
          .eq("event_id", eventId)
          .eq("lead_email", email);
        setLeadProjects(projects ?? []);
      }
    });
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const memberIds = useMemo(
    () => (myTeam ? myTeam.members.map((m) => m.user_id) : []),
    [myTeam]
  );

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast({ title: "Enter a team name", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const team = await createTeam(eventId, {
        name: teamName.trim(),
        memberUserIds: selectedIds,
      });
      setMyTeam(team);
      setTeamName("");
      setSelectedIds([]);
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

  const handleAddMembers = async () => {
    if (!myTeam || addIds.length === 0) return;
    setBusy(true);
    try {
      const team = await patchTeam(eventId, {
        teamId: myTeam.id,
        addUserIds: addIds,
      });
      setMyTeam(team);
      setAddIds([]);
      toast({ title: "Teammates added" });
    } catch (err) {
      toast({
        title: "Couldn't add teammates",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (removeUserId: string) => {
    if (!myTeam) return;
    setBusy(true);
    try {
      await deleteTeamOrMember(eventId, myTeam.id, removeUserId);
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

  const handleLeave = async () => {
    if (!myTeam || !userId) return;
    setBusy(true);
    try {
      await deleteTeamOrMember(eventId, myTeam.id, userId);
      setMyTeam(null);
      toast({ title: "You left the team" });
    } catch (err) {
      toast({
        title: "Couldn't leave team",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDissolve = async () => {
    if (!myTeam) return;
    setBusy(true);
    try {
      await deleteTeamOrMember(eventId, myTeam.id);
      setMyTeam(null);
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

  const handleLinkProject = async (value: string) => {
    if (!myTeam) return;
    const projectId = value === NO_PROJECT ? null : value;
    setBusy(true);
    try {
      const team = await patchTeam(eventId, { teamId: myTeam.id, projectId });
      setMyTeam(team);
      toast({ title: projectId ? "Project linked" : "Project unlinked" });
    } catch (err) {
      toast({
        title: "Couldn't update project link",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    uid: string
  ) => {
    setter((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-blue-900" />
      </div>
    );
  }

  // ---- No team yet: creation flow ----
  if (!myTeam) {
    return (
      <Card className="w-full bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Form your team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              placeholder="e.g. The Hack Pack"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Add teammates (optional)</Label>
            <TeammatePicker
              candidates={participants}
              selectedIds={selectedIds}
              onToggle={(uid) => toggle(setSelectedIds, uid)}
              excludeIds={userId ? [userId] : []}
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
    );
  }

  // ---- Existing team ----
  return (
    <Card className="w-full bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {myTeam.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col">
          <p className="text-[14px] font-medium text-gray-700 mb-1">
            Members ({myTeam.members.length})
          </p>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {myTeam.members.map((m) => (
              <TeamMemberRow
                key={m.user_id}
                member={m}
                isCurrentUser={m.user_id === userId}
                onRemove={
                  isLead && m.role !== TeamMemberRole.Lead
                    ? handleRemoveMember
                    : undefined
                }
                removing={busy}
              />
            ))}
          </div>
        </div>

        {isLead && (
          <div className="flex flex-col gap-2">
            <Label>Add teammates</Label>
            <TeammatePicker
              candidates={participants}
              selectedIds={addIds}
              onToggle={(uid) => toggle(setAddIds, uid)}
              excludeIds={memberIds}
              disabled={busy}
            />
            <div>
              <Button
                variant="secondary"
                onClick={handleAddMembers}
                disabled={busy || addIds.length === 0}
              >
                Add selected
              </Button>
            </div>
          </div>
        )}

        {isLead && leadProjects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Linked project (optional)</Label>
            <Select
              value={myTeam.project_id ?? NO_PROJECT}
              onValueChange={handleLinkProject}
              disabled={busy}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="No project linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project linked</SelectItem>
                {leadProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_name || "Untitled project"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-[rgba(0,0,0,0.08)]">
          <Button variant="outline" onClick={handleLeave} disabled={busy}>
            Leave team
          </Button>
          {isLead && (
            <Button
              variant="destructive"
              onClick={handleDissolve}
              disabled={busy}
            >
              Dissolve team
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
