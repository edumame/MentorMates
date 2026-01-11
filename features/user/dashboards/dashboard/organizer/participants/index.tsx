"use client";

import { useEffect, useState, useCallback } from "react";
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
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, ContentCopy } from "@mui/icons-material";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";

type ParticipantSortField = "display_name" | "email" | "role";

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

interface ParticipantRequest {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  form_responses: Record<string, unknown> | null;
  created_at: string;
  profiles?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface ParticipantsTabProps {
  eventId: string;
}

export function ParticipantsTab({ eventId }: ParticipantsTabProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyOnSave, setNotifyOnSave] = useState<boolean>(false);
  const [pendingRequests, setPendingRequests] = useState<ParticipantRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [decisionMessages, setDecisionMessages] = useState<Record<string, string>>({});
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [bulkDecisionMessage, setBulkDecisionMessage] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const participantSortFn = useCallback(
    (a: Participant, b: Participant, field: ParticipantSortField) => {
      switch (field) {
        case "display_name":
          return (a.display_name || "").localeCompare(b.display_name || "");
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "role":
          return (a.role || "").localeCompare(b.role || "");
        default:
          return 0;
      }
    },
    []
  );

  const { sortedData: sortedParticipants, handleSort, getSortDirection } = useTableSort(
    participants,
    { defaultField: "display_name" as ParticipantSortField },
    participantSortFn
  );

  const fetchParticipants = async () => {
    try {
      setLoading(true);
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
          `
        )
        .eq("event_id", eventId);

      if (leadError) throw leadError;

      // Transform the user_event_roles data
      const transformedData: Participant[] = (
        (data as UserEventRoleWithProfile[]) || []
      ).map((role) => ({
        user_id: role.user_id,
        role: role.role as EventRole,
        display_name:
          role.profiles?.display_name ||
          role.profiles?.email?.split("@")[0] ||
          "Unknown User",
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
  };

  const fetchPendingRequests = async () => {
    try {
      setPendingLoading(true);
      const res = await fetch(
        `/api/events/${eventId}/participant-requests?status=pending`
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload.error || "Failed to fetch requests");
      }
      const payload = await res.json();
      setPendingRequests(payload.requests || []);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    fetchPendingRequests();
  }, [eventId]);

  useEffect(() => {
    setSelectedRequestIds((prev) =>
      prev.filter((id) => pendingRequests.some((req) => req.id === id))
    );
  }, [pendingRequests]);

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
      .map((participant) => participant.email)
      .filter((email) => email) // Filter out empty emails
      .join(", ");

    try {
      await navigator.clipboard.writeText(emails);
      toast({ title: "Emails copied to clipboard" });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy emails to clipboard",
        variant: "destructive",
      });
    }
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

  const handleDecision = async (
    requestId: string,
    status: "approved" | "rejected"
  ) => {
    if (pendingActionId) return;
    try {
      setPendingActionId(requestId);
      const decisionMessage = decisionMessages[requestId];
      const res = await fetch(
        `/api/events/${eventId}/participant-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            decisionMessage: decisionMessage?.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload.error || "Failed to update request");
      }
      setPendingRequests((prev) => prev.filter((req) => req.id !== requestId));
      setDecisionMessages((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      if (status === "approved") {
        await fetchParticipants();
      }
      toast({
        title:
          status === "approved"
            ? "Participant approved"
            : "Participant rejected",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleBulkDecision = async (status: "approved" | "rejected") => {
    if (pendingActionId || selectedRequestIds.length === 0) return;
    try {
      setPendingActionId("bulk");
      const res = await fetch(
        `/api/events/${eventId}/participant-requests/bulk`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestIds: selectedRequestIds,
            status,
            decisionMessage: bulkDecisionMessage.trim() || undefined,
          }),
        }
      );
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update requests");
      }
      const updatedIds: string[] = payload.updated || [];
      const failed: Array<{ id: string; error: string }> = payload.failed || [];

      if (updatedIds.length > 0) {
        setPendingRequests((prev) =>
          prev.filter((req) => !updatedIds.includes(req.id))
        );
      }

      if (status === "approved" && updatedIds.length > 0) {
        await fetchParticipants();
      }

      setSelectedRequestIds((prev) =>
        prev.filter((id) => failed.some((item) => item.id === id))
      );

      toast({
        title:
          status === "approved"
            ? "Bulk approval complete"
            : "Bulk rejection complete",
        description: failed.length
          ? `${updatedIds.length} updated, ${failed.length} failed.`
          : `${updatedIds.length} updated.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPendingActionId(null);
    }
  };

  const allPendingSelected =
    pendingRequests.length > 0 &&
    selectedRequestIds.length === pendingRequests.length;
  const bulkCheckedState =
    allPendingSelected
      ? true
      : selectedRequestIds.length > 0
        ? "indeterminate"
        : false;

  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedRequestIds(pendingRequests.map((req) => req.id));
    } else {
      setSelectedRequestIds([]);
    }
  };

  const toggleSelectRequest = (
    requestId: string,
    checked: boolean | "indeterminate"
  ) => {
    setSelectedRequestIds((prev) =>
      checked
        ? Array.from(new Set([...prev, requestId]))
        : prev.filter((id) => id !== requestId)
    );
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/participants/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify: notifyOnSave }),
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
          <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 p-4">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold">Pending Approvals</h4>
              <p className="text-xs text-muted-foreground">
                Review interest submissions before participants are added.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-requests"
                  checked={bulkCheckedState}
                  onCheckedChange={toggleSelectAll}
                  disabled={pendingRequests.length === 0}
                />
                <Label
                  htmlFor="select-all-requests"
                  className="text-xs text-muted-foreground"
                >
                  Select all
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleBulkDecision("approved")}
                  disabled={
                    pendingActionId === "bulk" || selectedRequestIds.length === 0
                  }
                >
                  Approve selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkDecision("rejected")}
                  disabled={
                    pendingActionId === "bulk" || selectedRequestIds.length === 0
                  }
                >
                  Reject selected
                </Button>
              </div>
            </div>
            <Textarea
              value={bulkDecisionMessage}
              onChange={(event) => setBulkDecisionMessage(event.target.value)}
              placeholder="Optional bulk message to participants"
              className="min-h-[80px]"
            />
            {pendingLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading pending requests...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No pending requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-md border bg-background p-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-3">
                        <Checkbox
                          checked={selectedRequestIds.includes(request.id)}
                          onCheckedChange={(checked) =>
                            toggleSelectRequest(request.id, checked)
                          }
                          className="mt-1"
                        />
                        <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {request.profiles?.display_name ||
                              request.profiles?.email ||
                              "Unknown participant"}
                          </p>
                          {request.profiles?.email && (
                            <p className="text-xs text-muted-foreground">
                              {request.profiles.email}
                            </p>
                          )}
                        </div>
                        {request.form_responses &&
                        typeof request.form_responses === "object" ? (
                          <p className="text-sm text-muted-foreground">
                            {String(
                              (request.form_responses as any).motivation ||
                                "No motivation provided."
                            )}
                          </p>
                        ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleDecision(request.id, "approved")}
                            disabled={
                              pendingActionId === request.id ||
                              pendingActionId === "bulk"
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecision(request.id, "rejected")}
                            disabled={
                              pendingActionId === request.id ||
                              pendingActionId === "bulk"
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3">
                      <Textarea
                        value={decisionMessages[request.id] || ""}
                        onChange={(event) =>
                          setDecisionMessages((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Optional message to the participant"
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {loading ? (
            <div>Loading participants...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-on-save"
                    checked={notifyOnSave}
                    onCheckedChange={(checked) => setNotifyOnSave(Boolean(checked))}
                  />
                  <Label htmlFor="notify-on-save" className="text-sm text-muted-foreground">
                    Notify participant when saving changes
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopyEmails} variant="outline" size="sm">
                    <ContentCopy className="w-4 h-4 mr-2" />
                    Copy Emails
                  </Button>
                  <Button onClick={handleExportCSV} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHeader<ParticipantSortField>
                      field="display_name"
                      label="Name"
                      sortDirection={getSortDirection("display_name")}
                      onSort={handleSort}
                    />
                    <SortableTableHeader<ParticipantSortField>
                      field="email"
                      label="Email"
                      sortDirection={getSortDirection("email")}
                      onSort={handleSort}
                    />
                    <SortableTableHeader<ParticipantSortField>
                      field="role"
                      label="Role"
                      sortDirection={getSortDirection("role")}
                      onSort={handleSort}
                    />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedParticipants.map((participant) => (
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
