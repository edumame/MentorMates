"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { EventRole, EventDetails } from "@/lib/types";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ApprovalRequestsTab } from "./ApprovalRequestsTab";
import { ApprovalSettingsTab } from "./ApprovalSettingsTab";
import { AssignTab } from "../assign";

interface UserEventRoleWithProfile {
  user_id: string;
  role: string;
  profiles: {
    display_name: string;
    email: string;
  } | null;
}

interface Participant {
  user_id: string;
  role: EventRole;
  display_name: string;
  email: string;
}

interface ParticipantsTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived: boolean;
}

interface ProjectRow {
  lead_email: string | null;
  teammates: string[] | null;
}

export function ParticipantsTab({ eventId, event, setEvent, isArchived }: ParticipantsTabProps) {
  const PAGE_SIZE = 10;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const { toast } = useToast();
  const notifyOnSave = false;

  useEffect(() => {
    async function fetchParticipants() {
      try {
        const participantsResponse = await fetch(
          `/api/events/${eventId}/users?roles=participant,mentor,judge,organizer,admin&limit=500`
        );
        const participantsPayload = await participantsResponse.json();
        if (!participantsResponse.ok) {
          throw new Error(
            participantsPayload.error || "Failed to fetch participants"
          );
        }
        const data = (participantsPayload.users || []).map(
          (user: {
            user_id: string;
            role: EventRole;
            display_name: string;
            email: string;
          }) => ({
            user_id: user.user_id,
            role: user.role,
            profiles: {
              display_name: user.display_name,
              email: user.email,
            },
          })
        ) as UserEventRoleWithProfile[];

        const { data: projectRows, error: projectError } = await supabase
          .from("projects")
          .select("lead_email, teammates")
          .eq("event_id", eventId)
          .overrideTypes<ProjectRow[]>();

        if (projectError) throw projectError;

        const transformedData: Participant[] = (data ?? []).map((roleRow) => ({
          user_id: roleRow.user_id,
          role: roleRow.role as EventRole,
          display_name:
            roleRow.profiles?.display_name ||
            roleRow.profiles?.email?.split("@")[0] ||
            "Unknown User",
          email: roleRow.profiles?.email ?? "",
        }));

        const projectParticipants: Participant[] = [];
        const allEmails = new Set<string>();

        transformedData.forEach((p) => {
          if (p.email) allEmails.add(p.email.toLowerCase());
        });

        (projectRows ?? []).forEach((project) => {
          // lead_email
          if (project.lead_email) {
            const leadEmailLower = project.lead_email.toLowerCase();
            if (!allEmails.has(leadEmailLower)) {
              projectParticipants.push({
                user_id: `project-lead-${leadEmailLower}`,
                role: EventRole.Participant,
                display_name: project.lead_email,
                email: project.lead_email,
              });
              allEmails.add(leadEmailLower);
            }
          }

          // teammates
          const teammates = project.teammates ?? [];
          teammates.forEach((teammateEmail) => {
            if (!teammateEmail) return;
            const teammateLower = teammateEmail.toLowerCase();
            if (!allEmails.has(teammateLower)) {
              projectParticipants.push({
                user_id: `project-teammate-${teammateLower}`,
                role: EventRole.Participant,
                display_name: teammateEmail,
                email: teammateEmail,
              });
              allEmails.add(teammateLower);
            }
          });
        });

        setParticipants([...transformedData, ...projectParticipants]);
      } catch (error) {
        console.error("Error fetching participants:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchParticipants();
  }, [eventId]);

  const totalPages = Math.max(1, Math.ceil(participants.length / PAGE_SIZE));
  const clampedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (clampedCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pagedParticipants = participants.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage !== clampedCurrentPage) setCurrentPage(clampedCurrentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedCurrentPage]);

  const getPageItems = (): Array<number | "ellipsis"> => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const items: Array<number | "ellipsis"> = [];
    const left = Math.max(2, clampedCurrentPage - 1);
    const right = Math.min(totalPages - 1, clampedCurrentPage + 1);

    items.push(1);
    if (left > 2) items.push("ellipsis");
    for (let p = left; p <= right; p++) items.push(p);
    if (right < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);

    return items;
  };

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

  const handleCopyEmails = async () => {
    const emails = participants
      .map((p) => p.email.trim())
      .filter((e) => e.length > 0);

    try {
      await navigator.clipboard.writeText(emails.join(", "));
      toast({ title: "Copied emails", description: `${emails.length} copied` });
    } catch {
      toast({
        title: "Error",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const safeParseJson = async (response: Response): Promise<unknown> => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const getErrorMessageFromResponseData = (data: unknown): string | undefined => {
    if (typeof data !== "object" || data === null) return undefined;
    const maybeError = (data as Record<string, unknown>).error;
    return typeof maybeError === "string" ? maybeError : undefined;
  };

  const navigateToProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleChangeRole = async (userId: string, newRole: EventRole) => {
    try {
      const res = await fetch(`/api/events/${eventId}/participants/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, notify: notifyOnSave }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Failed to update role");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify: notifyOnSave }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Failed to remove user");
      }

      setParticipants((prev) => prev.filter((p) => p.user_id !== userId));

      toast({ title: "Removed from event" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove user";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const [topSection, setTopSection] = useState<"registration" | "assign-roles">("registration");
  const [activeTab, setActiveTab] = useState("list");

  return (
    <Card className="border-0 bg-transparent shadow-none px-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-0 pt-0 pb-6">
        <Tabs value={topSection} onValueChange={(v) => setTopSection(v as "registration" | "assign-roles")} className="w-auto">
          <TabsList className="flex h-auto gap-2 p-0 bg-transparent border-0 shadow-none rounded-none">
            <TabsTrigger
              value="registration"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
            >
              Registration
              <Badge variant="secondary" className="rounded-full font-normal text-sm text-[var(--Color-Neutral,#737373)] bg-transparent border-0 px-0 hover:bg-transparent">
                {participants.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="assign-roles"
              className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
            >
              Assign Roles
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {topSection === "registration" && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopyEmails}
              variant="outline"
              size="sm"
              className="flex h-11 items-center px-5 py-2 rounded-[var(--Radius-Medium,12px)] border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] bg-[var(--Color-Scheme-1-Foreground,#FFF)] text-[var(--Color-Scheme-1-Text,#000)] font-normal text-base leading-[1.5]"
              type="button"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy emails
            </Button>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="flex h-11 items-center px-5 py-2 rounded-[var(--Radius-Medium,12px)] border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] bg-[var(--Color-Scheme-1-Foreground,#FFF)] text-[var(--Color-Scheme-1-Text,#000)] font-normal text-base leading-[1.5]"
              type="button"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0">
        {topSection === "assign-roles" ? (
          <AssignTab eventId={eventId} />
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Participant List</TabsTrigger>
            <TabsTrigger value="approval-requests">Approval Requests</TabsTrigger>
            <TabsTrigger value="approval-settings">Approval Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <div className="space-y-4">
              {loading ? (
                <div>Loading participants...</div>
              ) : (
                <>
                  <div className="rounded-lg border bg-card">
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
                        {pagedParticipants.map((participant) => (
                          <TableRow
                            key={participant.user_id}
                            onClick={() => {
                              if (!participant.user_id.startsWith("project-")) {
                                navigateToProfile(participant.user_id);
                              }
                            }}
                            className={
                              !participant.user_id.startsWith("project-")
                                ? "cursor-pointer hover:bg-gray-50"
                                : "cursor-default"
                            }
                          >
                            <TableCell>{participant.display_name}</TableCell>
                            <TableCell>{participant.email}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {!participant.user_id.startsWith("project-") ? (
                                <Select
                                  value={participant.role}
                                  onValueChange={(val) =>
                                    handleChangeRole(participant.user_id, val as EventRole)
                                  }
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
                              {!participant.user_id.startsWith("project-") && (
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
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4">
                    <Button
                      variant="secondary"
                      size="default"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={clampedCurrentPage === 1}
                      className="min-w-[110px]"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Prev
                    </Button>

                    <div className="flex items-center justify-center gap-2">
                      {getPageItems().map((item, idx) => {
                        if (item === "ellipsis") {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-2 text-sm text-muted-foreground"
                              aria-hidden="true"
                            >
                              …
                            </span>
                          );
                        }
                        const isActive = item === clampedCurrentPage;
                        return (
                          <Button
                            key={item}
                            variant={isActive ? "outline" : "ghost"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentPage(item)}
                            aria-current={isActive ? "page" : undefined}
                          >
                            {item}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="secondary"
                      size="default"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={clampedCurrentPage === totalPages}
                      className="min-w-[110px]"
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approval-requests" className="mt-6">
            <ApprovalRequestsTab eventId={eventId} isArchived={isArchived} />
          </TabsContent>

          <TabsContent value="approval-settings" className="mt-6">
            <ApprovalSettingsTab
              eventId={eventId}
              event={event}
              setEvent={setEvent}
              isArchived={isArchived}
            />
          </TabsContent>
        </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
