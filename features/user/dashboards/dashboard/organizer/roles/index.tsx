"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { EventRole, EventDetails } from "@/lib/types";
import { useToast } from "@/lib/hooks/use-toast";
import {
  EvidenceLetterDialog,
  JudgeEvidenceContext,
} from "./EvidenceLetterDialog";

interface RolesTabProps {
  eventId: string;
  event: EventDetails;
}

interface MemberRow {
  user_id: string;
  role: EventRole;
  display_name: string;
  email: string;
}

interface JudgeStat {
  user_id: string;
  display_name: string;
  email: string;
  affiliation: string;
  projects_judged: number;
}

interface JudgeStatsResponse {
  event: {
    event_id: string;
    event_name: string;
    event_date: string;
    location: string | null;
  };
  attendance: number;
  judges: JudgeStat[];
}

const ROLE_ORDER: EventRole[] = [
  EventRole.Organizer,
  EventRole.Judge,
  EventRole.Mentor,
  EventRole.Participant,
  EventRole.Admin,
];

const ROLE_LABELS: Record<EventRole, string> = {
  [EventRole.Organizer]: "Organizers",
  [EventRole.Judge]: "Judges",
  [EventRole.Mentor]: "Mentors",
  [EventRole.Participant]: "Participants",
  [EventRole.Admin]: "Admins",
};

export function RolesTab({ eventId, event }: RolesTabProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [judgeStats, setJudgeStats] = useState<JudgeStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedInName, setSignedInName] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeJudge, setActiveJudge] = useState<JudgeEvidenceContext | null>(
    null
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, statsRes, sessionRes] = await Promise.all([
        fetch(
          `/api/events/${eventId}/users?roles=participant,mentor,judge,organizer,admin&limit=500`
        ),
        fetch(`/api/events/${eventId}/judge-stats`),
        supabase.auth.getSession(),
      ]);

      if (!membersRes.ok) {
        throw new Error("Failed to load event members");
      }
      const membersJson = (await membersRes.json()) as {
        users: MemberRow[];
      };
      setMembers(membersJson.users || []);

      if (statsRes.ok) {
        const statsJson = (await statsRes.json()) as JudgeStatsResponse;
        setJudgeStats(statsJson);
      } else {
        setJudgeStats(null);
      }

      const session = sessionRes.data.session;
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name, email")
          .eq("uid", session.user.id)
          .maybeSingle();
        setSignedInName(
          profile?.display_name || profile?.email || session.user.email || ""
        );
      }
    } catch (err) {
      console.error("Error loading roles data", err);
      toast({
        title: "Couldn't load roles",
        description:
          err instanceof Error ? err.message : "Unexpected error loading data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const grouped = useMemo(() => {
    const map = new Map<EventRole, MemberRow[]>();
    members.forEach((m) => {
      const list = map.get(m.role) ?? [];
      list.push(m);
      map.set(m.role, list);
    });
    return map;
  }, [members]);

  const judgeStatById = useMemo(() => {
    const map = new Map<string, JudgeStat>();
    (judgeStats?.judges || []).forEach((j) => map.set(j.user_id, j));
    return map;
  }, [judgeStats]);

  const handleExportLetter = (member: MemberRow) => {
    const stat = judgeStatById.get(member.user_id);
    setActiveJudge({
      judgeName: member.display_name || member.email || "",
      judgeEmail: member.email,
      projectsJudged: stat?.projects_judged ?? 0,
      eventName: judgeStats?.event.event_name || event.event_name || "",
      eventDate: judgeStats?.event.event_date || event.event_date || "",
      attendance: judgeStats?.attendance ?? 0,
      organizerName: signedInName || "",
      organizerRole: "Organizer",
      organizerOrg: event.event_name || "",
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="px-0 py-12">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="h-5 w-5" />
          Roles
        </CardTitle>
        <CardDescription>
          People associated with this event, grouped by role. Judges have an
          option to export an evidence letter (e.g. for an O1 visa packet).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8 px-0">
        {ROLE_ORDER.map((role) => {
          const rows = grouped.get(role) ?? [];
          if (rows.length === 0) return null;
          const isJudgeRole = role === EventRole.Judge;
          return (
            <section key={role} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold capitalize">
                  {ROLE_LABELS[role]}
                </h3>
                <Badge variant="secondary" className="rounded-full">
                  {rows.length}
                </Badge>
              </div>

              <div className="rounded-[16px] border border-[rgba(0,0,0,0.15)] bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Email</TableHead>
                      {isJudgeRole && (
                        <TableHead className="text-right">
                          Projects judged
                        </TableHead>
                      )}
                      {isJudgeRole && (
                        <TableHead className="pr-6 text-right">
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((member) => {
                      const stat = isJudgeRole
                        ? judgeStatById.get(member.user_id)
                        : undefined;
                      return (
                        <TableRow key={`${role}-${member.user_id}`}>
                          <TableCell className="pl-6">
                            {member.display_name ||
                              member.email?.split("@")[0] ||
                              "Unknown"}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          {isJudgeRole && (
                            <TableCell className="text-right">
                              {stat?.projects_judged ?? 0}
                            </TableCell>
                          )}
                          {isJudgeRole && (
                            <TableCell className="pr-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportLetter(member)}
                              >
                                <FileDown className="mr-2 h-4 w-4" />
                                Export Evidence Letter
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          );
        })}

        {members.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            No members found for this event yet.
          </div>
        )}
      </CardContent>

      <EvidenceLetterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={activeJudge}
      />
    </Card>
  );
}
