"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { supabase } from "@/lib/supabase";
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

      // First, get total count for pagination
      const { count } = await supabase
        .from("user_event_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("role", "participant");

      setTotalPages(Math.ceil((count || 0) / USERS_PER_PAGE));

      // Then fetch the current page of users
      const { data: eventUsers, error } = await supabase
        .from("user_event_roles")
        .select(
          `
          user_profiles (
            uid,
            email,
            display_name
          )
        `
        )
        .eq("event_id", eventId)
        .eq("role", "participant")
        .range(
          currentPage * USERS_PER_PAGE,
          (currentPage + 1) * USERS_PER_PAGE - 1
        )
        .order("created_at", { ascending: true })
        .overrideTypes<{ user_profiles: UserProfileWithEmail }[]>();

      if (error) throw error;

      setUsers(eventUsers.map((user) => user.user_profiles));
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
        <h2 className="text-2xl font-bold">Send Individual Check-in Emails</h2>
        <p className="text-gray-600">
          Select a participant to send them their check-in QR code email.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell>{user.display_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>Participant</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => sendCheckinEmail(user)}
                      disabled={isSending}
                      size="sm"
                    >
                      Send Email
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center">
        <Button
          onClick={() => setCurrentPage((p) => p - 1)}
          disabled={currentPage === 0 || loading}
        >
          Previous
        </Button>
        <span className="text-sm text-gray-600">
          Page {currentPage + 1} of {totalPages}
        </span>
        <Button
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={currentPage >= totalPages - 1 || loading}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
