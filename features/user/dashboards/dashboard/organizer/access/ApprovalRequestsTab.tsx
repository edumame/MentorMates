"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import {
  ParticipantApprovalRequest,
  ParticipantRequestStatus,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Loader2, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ApprovalRequestsTabProps {
  eventId: string;
  isArchived: boolean;
}

export function ApprovalRequestsTab({
  eventId,
  isArchived,
}: ApprovalRequestsTabProps) {
  const [requests, setRequests] = useState<ParticipantApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<ParticipantApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `/api/events/${eventId}/approval-requests?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch requests");
      }

      setRequests(data.requests || []);
      setPendingCount(data.pending_count || 0);
    } catch (error) {
      console.error("Error fetching approval requests:", error);
      toast({
        title: "Error",
        description: "Failed to load approval requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, statusFilter, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`approval-requests-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participant_approval_requests",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchRequests]);

  const handleApprove = async (request: ParticipantApprovalRequest) => {
    try {
      setIsProcessing(request.id);

      const response = await fetch(
        `/api/events/${eventId}/approval-requests/${request.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: ParticipantRequestStatus.Approved,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve request");
      }

      toast({
        title: "Request Approved",
        description: `${request.user_profile?.display_name || "User"} has been added to the event.`,
      });

      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectClick = (request: ParticipantApprovalRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;

    try {
      setIsProcessing(selectedRequest.id);

      const response = await fetch(
        `/api/events/${eventId}/approval-requests/${selectedRequest.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: ParticipantRequestStatus.Rejected,
            rejection_reason: rejectionReason || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject request");
      }

      toast({
        title: "Request Rejected",
        description: `The request from ${selectedRequest.user_profile?.display_name || "User"} has been rejected.`,
      });

      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusBadge = (status: ParticipantRequestStatus) => {
    switch (status) {
      case ParticipantRequestStatus.Pending:
        return <Badge variant="outline">Pending</Badge>;
      case ParticipantRequestStatus.Approved:
        return <Badge variant="default">Approved</Badge>;
      case ParticipantRequestStatus.Rejected:
        return <Badge variant="destructive">Rejected</Badge>;
      case ParticipantRequestStatus.Withdrawn:
        return <Badge variant="secondary">Withdrawn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">
                Pending {pendingCount > 0 && `(${pendingCount})`}
              </SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-sm">
            {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No {statusFilter !== "all" ? statusFilter : ""} requests found.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={request.user_profile?.avatar_url}
                          alt={request.user_profile?.display_name}
                        />
                        <AvatarFallback>
                          {getInitials(
                            request.user_profile?.display_name || "U"
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {request.user_profile?.display_name || "Unknown User"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.user_profile?.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm">
                      {request.reason || (
                        <span className="text-muted-foreground italic">
                          No reason provided
                        </span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(request.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === ParticipantRequestStatus.Pending &&
                      !isArchived && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(request)}
                            disabled={isProcessing === request.id}
                          >
                            {isProcessing === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            <span className="ml-1">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(request)}
                            disabled={isProcessing === request.id}
                          >
                            <X className="h-4 w-4" />
                            <span className="ml-1">Reject</span>
                          </Button>
                        </div>
                      )}
                    {request.status === ParticipantRequestStatus.Rejected &&
                      request.rejection_reason && (
                        <p className="text-sm text-muted-foreground italic">
                          Reason: {request.rejection_reason}
                        </p>
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              You can optionally provide a reason for rejecting this request.
              The applicant will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rejection Reason (Optional)
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Event is at capacity, not meeting requirements..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isProcessing !== null}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
