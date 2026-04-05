"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserProfile } from "@/lib/types";

interface EmailDashboardProps {
  eventId: string;
  eventName: string;
}

type UserProfileWithEmail = UserProfile & {
  email: string;
};

const USERS_PER_PAGE = 25;

export default function EmailDashboard({
  eventId,
  eventName,
}: EmailDashboardProps) {
  const [users, setUsers] = useState<UserProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * USERS_PER_PAGE;
      const response = await fetch(
        `/api/events/${eventId}/users?roles=participant&limit=${USERS_PER_PAGE}&offset=${offset}&includeCount=true`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load users");

      const fetchedUsers: UserProfileWithEmail[] = (payload.users || []).map(
        (user: {
          uid: string;
          display_name: string;
          email: string;
        }) => ({
          uid: user.uid,
          display_name: user.display_name || "Unknown User",
          email: user.email || "",
        })
      );

      setUsers(fetchedUsers);
      setTotalPages(Math.ceil((payload.count || 0) / USERS_PER_PAGE));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, eventId, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const sendCheckinEmail = async (user: UserProfileWithEmail) => {
    setIsSending(true);
    try {
        const response = await fetch(`/api/email_notification/user/${user.uid}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId,
            eventName,
            emailType: EMAIL_TYPES.CHECKIN_QR_CODE,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to send email");
        }

      toast({
        title: "Success",
        description: `Check-in email sent to ${user.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to send check-in email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <h2
        className="font-geist text-2xl font-semibold"
        style={{
          fontFamily:
            "var(--font-geist-sans), Inter, system-ui, sans-serif",
        }}
      >
        Send Individual Check-in Emails
      </h2>
        <p className="font-geist text-gray-600">
          Select a participant to send them their check-in QR code email.
        </p>
      </div>

      <div className="rounded-[16px] border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6">Name</TableHead>
              <TableHead className="px-6">Email</TableHead>
              <TableHead className="px-6">Role</TableHead>
              <TableHead className="px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 px-6">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 px-6">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="px-6">{user.display_name}</TableCell>
                  <TableCell className="px-6">{user.email}</TableCell>
                  <TableCell className="px-6">Participant</TableCell>
                  <TableCell className="px-6">
                    <Button
                      onClick={() => sendCheckinEmail(user)}
                      disabled={isSending}
                      size="sm"
                    >
                      Send Check-in Email
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls - match Registration page style */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <Button
          variant="secondary"
          size="default"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0 || loading}
          className="min-w-[110px] flex justify-center items-center gap-1.5 py-2.5 px-6 rounded-[12px] bg-[var(--Opacity-Neutral-Darkest-5,rgba(0,0,0,0.05))] border-0 text-foreground hover:bg-[var(--Opacity-Neutral-Darkest-5,rgba(0,0,0,0.05))] hover:opacity-90"
          style={{
            boxShadow:
              "0 0 0 1px var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05)) inset, 0 -2px 1px 0 var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05)) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05))",
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
        </div>
        <Button
          variant="secondary"
          size="default"
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={currentPage >= totalPages - 1 || loading}
          className="min-w-[110px] flex justify-center items-center gap-1.5 py-2.5 px-6 rounded-[12px] bg-[var(--Opacity-Neutral-Darkest-5,rgba(0,0,0,0.05))] border-0 text-foreground hover:bg-[var(--Opacity-Neutral-Darkest-5,rgba(0,0,0,0.05))] hover:opacity-90"
          style={{
            boxShadow:
              "0 0 0 1px var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05)) inset, 0 -2px 1px 0 var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05)) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0,0,0,0.05))",
          }}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
