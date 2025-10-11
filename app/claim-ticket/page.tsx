"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ticket, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface TicketInfo {
  id: string;
  event_id: string;
  event: {
    event_id: string;
    event_name: string;
    event_date: string;
    event_description: string | null;
  };
  assigned_to_email: string | null;
  ticket_status: string;
  purchased_by: {
    display_name: string | null;
    email: string;
  };
}

export default function ClaimTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");

  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!ticketId) {
      setError("No ticket ID provided");
      setLoading(false);
      return;
    }

    const fetchTicket = async () => {
      try {
        const { data: ticketData, error } = await supabase
          .from("event_tickets")
          .select(
            `
            id,
            event_id,
            assigned_to_email,
            ticket_status,
            assigned_to_user_id,
            event:events!inner(
              event_id,
              event_name,
              event_date,
              event_description
            ),
            purchased_by:user_profiles!event_tickets_purchased_by_user_id_fkey(
              display_name,
              email
            )
          `
          )
          .eq("id", ticketId)
          .single()
          .overrideTypes<TicketInfo>();

        if (error) {
          setError("Ticket not found");
          return;
        }

        if (ticketData.assigned_to_user_id) {
          setError("This ticket has already been claimed");
          return;
        }

        setTicket(ticketData);
      } catch (error) {
        console.error("Error fetching ticket:", error);
        setError("Failed to load ticket information");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId]);

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    localStorage.setItem(
      "returnUrl",
      window.location.pathname + window.location.search
    );
    router.push("/login");
  };

  const claimTicket = async () => {
    if (!user || !ticket) return;

    console.log("user", user);

    setClaiming(true);
    setError(null);

    try {
      //check if the user already has a role for this event
      const { data: existingRole } = await supabase
        .from("user_event_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", ticket.event.event_id)
        .single();

      if (existingRole) {
        setError("You are already registered for this event.");
        return;
      }

      //check if user email is the same as the assigned_to_email
      if (user.email !== ticket.assigned_to_email) {
        setError(
          "The email address you are signed in with does not match the email address assigned to this ticket."
        );
        return;
      }

      // Update the ticket
      const { error: ticketError } = await supabase
        .from("event_tickets")
        .update({
          assigned_to_user_id: user.id,
          ticket_status: "assigned",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (ticketError) throw ticketError;

      // Create a participant role for the user
      const { error: roleError } = await supabase
        .from("user_event_roles")
        .insert({
          user_id: user.id,
          event_id: ticket.event.event_id,
          role: "participant",
        });

      if (roleError) throw roleError;

      setSuccess(true);

      // Redirect to event page after a short delay
      setTimeout(() => {
        router.push(`/events/${ticket.event_id}/overview`);
      }, 3000);
    } catch (error) {
      console.error("Error claiming ticket:", error);
      setError("Failed to claim ticket. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-900" />
          <span>Loading ticket information...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Ticket Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/")} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Ticket Claimed!</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Your ticket for <strong>{ticket?.event.event_name}</strong> has
              been successfully claimed. You will be redirected to the event
              page shortly.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-900" />
              <span>Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Ticket className="h-6 w-6" />
            <span>Claim Your Event Ticket</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {ticket && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {ticket.event.event_name}
                </h3>
                <p className="text-gray-600">
                  {new Date(ticket.event.event_date).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>

              {ticket.event.event_description && (
                <p className="text-gray-700 text-sm">
                  {ticket.event.event_description}
                </p>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This ticket was purchased by{" "}
                  <strong>
                    {ticket.purchased_by.display_name ||
                      ticket.purchased_by.email}
                  </strong>{" "}
                  and assigned to <strong>{ticket.assigned_to_email}</strong>
                </AlertDescription>
              </Alert>

              <div className="pt-4">
                {!user ? (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                      You need to sign in to claim this ticket.
                    </p>
                    <Button onClick={handleLogin} className="w-full">
                      Sign In to Claim Ticket
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                      Signed in as <strong>{user.email}</strong>
                    </p>
                    <Button
                      onClick={claimTicket}
                      disabled={claiming}
                      className="w-full"
                    >
                      {claiming ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-900" />
                          Claiming Ticket...
                        </>
                      ) : (
                        "Claim This Ticket"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
