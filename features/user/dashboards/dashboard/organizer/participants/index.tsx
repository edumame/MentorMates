"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { EventRole } from "@/lib/types";
import Papa from "papaparse";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "@mui/icons-material";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";

interface UserEventRoleWithProfile {
  user_id: string;
  role: string;
  profiles: {
    display_name: string;
    email: string;
  };
}

interface Participant {
  user_id: string;
  role: EventRole;
  display_name: string;
  email: string;
}

interface ParticipantsTabProps {
  eventId: string;
}

export function ParticipantsTab({ eventId }: ParticipantsTabProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchParticipants() {
      try {
        // Get participants with their profile info
        const { data, error } = await supabase
          .from("user_event_roles")
          .select(
            `
            user_id,
            role,
            profiles:user_id (
              display_name,
              email
            )
          `
          )
          .eq("event_id", eventId)
          .overrideTypes<UserEventRoleWithProfile[]>();

        if (error) throw error;

        // get all lead email and teammembers 
        const { data: leadData, error: leadError } = await supabase
        .from("projects")
        .select(
          `
          lead_email, 
          teammates
          `)
        .eq("event_id", eventId);

        if (leadError) throw leadError;

        // Transform the user_event_roles data
        const transformedData: Participant[] = (
          (data as UserEventRoleWithProfile[]) || []
        ).map((role) => ({
          user_id: role.user_id,
          role: role.role as EventRole,
          display_name: role.profiles?.display_name || role.profiles?.email?.split("@")[0] || "Unknown User",
          email: role.profiles?.email || "",
        }));

        // Transform project participants (lead_email and teammates)
        const projectParticipants: Participant[] = [];
        const allEmails = new Set<string>();

        // Add existing participants' emails to the set
        transformedData.forEach((participant) => {
          if (participant.email) {
            allEmails.add(participant.email.toLowerCase());
          }
        });

        // Process project data
        if (leadData && leadData.length > 0) {
          leadData.forEach((project) => {
            // Add lead email
            if (project.lead_email) {
              const leadEmail = project.lead_email.toLowerCase();
              if (!allEmails.has(leadEmail)) {
                projectParticipants.push({
                  user_id: `project-lead-${leadEmail}`, // Generate a unique ID for project participants
                  role: "participant" as EventRole,
                  display_name: `project-lead-${project.lead_email}`, // Use email as display name since we don't have profile data
                  email: project.lead_email,
                });
                allEmails.add(leadEmail);
              }
            }

            // Add teammates
            if (project.teammates && Array.isArray(project.teammates)) {
              project.teammates.forEach((teammate: string) => {
                const teammateEmail = teammate.toLowerCase();
                if (teammate && !allEmails.has(teammateEmail)) {
                  projectParticipants.push({
                    user_id: `project-teammate-${teammateEmail}`, // Generate a unique ID for project participants
                    role: "participant" as EventRole,
                    display_name: `project-teammate-${teammate}`, // Use email as display name since we don't have profile data
                    email: teammate,
                  });
                  allEmails.add(teammateEmail);
                }
              });
            }
          });
        }

        // Combine all participants and filter for unique emails
        const allParticipants = [...transformedData, ...projectParticipants];
        
        setParticipants(allParticipants);
      } catch (error) {
        console.error("Error fetching participants:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchParticipants();
  }, [eventId]);

  const handleExportCSV = () => {
    const csv = Papa.unparse(
      participants.map((participant) => ({
        Name: participant.display_name,
        Email: participant.email,
        Role: participant.role,
      }))
    );

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${eventId}.csv`;
    a.click();
  };

  const navigateToProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleChangeRole = async (userId: string, newRole: EventRole) => {
    try {
      const res = await fetch(`/api/events/${eventId}/participants/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        throw new Error((data as any).error || "Failed to update role");
      }
      setParticipants((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, role: newRole } : p))
      );
      toast({ title: "Role updated" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/participants/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        throw new Error((data as any).error || "Failed to remove user");
      }
      setParticipants((prev) => prev.filter((p) => p.user_id !== userId));
      toast({ title: "Removed from event" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove user";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Participants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div>Loading participants...</div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={handleExportCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow
                      key={participant.user_id}
                      onClick={() => {
                        // Only navigate to profile for actual users, not project participants
                        if (!participant.user_id.startsWith('project-')) {
                          navigateToProfile(participant.user_id);
                        }
                      }}
                      className={`${
                        !participant.user_id.startsWith('project-') 
                          ? 'cursor-pointer hover:bg-gray-50' 
                          : 'cursor-default'
                      }`}
                    >
                      <TableCell>{participant.display_name}</TableCell>
                      <TableCell>{participant.email}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {!participant.user_id.startsWith('project-') ? (
                          <Select
                            value={participant.role}
                            onValueChange={(val) => handleChangeRole(participant.user_id, val as EventRole)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={EventRole.Participant}>Participant</SelectItem>
                              <SelectItem value={EventRole.Mentor}>Mentor</SelectItem>
                              <SelectItem value={EventRole.Judge}>Judge</SelectItem>
                              <SelectItem value={EventRole.Organizer}>Organizer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize">{participant.role}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {!participant.user_id.startsWith('project-') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleRemove(participant.user_id)}
                            aria-label={`Remove ${participant.display_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
