"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  Mail,
  User as UserIcon,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { getClaimTicketEmailTemplate } from "@/lib/email_templates/claim-ticket";
import { User } from "@supabase/supabase-js";

interface EventTicket {
  id: string;
  assigned_to_user_id: string | null;
  assigned_to_email: string | null;
  ticket_status: string;
  assigned_at: string | null;
  created_at: string;
  assigned_user?: {
    display_name: string | null;
    email: string;
  };
}

interface ViewTicketsTabProps {
  eventId: string;
}

export function ViewTicketsTab({ eventId }: ViewTicketsTabProps) {
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [ticketEmails, setTicketEmails] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserAndTickets = async () => {
      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setUser(session.user);

      // Fetch tickets purchased by this user for this event
      const { data: tickets, error } = await supabase
        .from("event_tickets")
        .select(
          `
          id,
          assigned_to_user_id,
          assigned_to_email,
          ticket_status,
          assigned_at,
          created_at,
          assigned_user:user_profiles!event_tickets_assigned_to_user_id_fkey(
            display_name,
            email
          )
        `
        )
        .eq("event_id", eventId)
        .eq("purchased_by_user_id", session.user.id)
        .order("created_at", { ascending: true })
        .overrideTypes<EventTicket[]>();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load tickets",
          variant: "destructive",
        });
        return;
      }

      setTickets(tickets || []);
      setLoading(false);
    };

    fetchUserAndTickets();
  }, [eventId, toast]);

  const assignTicket = async (ticketId: string) => {
    const ticketEmail = ticketEmails[ticketId]?.trim();
    
    if (!ticketEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ticketEmail)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setAssigning(ticketId);

    try {
      // Update ticket with email assignment
      const { error: updateError } = await supabase
        .from("event_tickets")
        .update({
          assigned_to_email: ticketEmail,
          ticket_status: "assigned",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (updateError) throw updateError;

      // Get event and user info for email
      const { data: eventData } = await supabase
        .from("events")
        .select("event_name")
        .eq("event_id", eventId)
        .single();

      const email = getClaimTicketEmailTemplate(
        eventData?.event_name || "Event",
        ticketId,
        user?.user_metadata?.display_name || user?.email || "Someone"
      );

      // Send claim ticket email
      const response = await fetch("/api/email_notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: ticketEmail,
          from: NOTIFICATIONS_EMAIL_FROM,
          subject: email.subject,
          html: email.html,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invitation email");
      }

      // Refresh tickets
      const { data: updatedTickets } = await supabase
        .from("event_tickets")
        .select(
          `
          id,
          assigned_to_user_id,
          assigned_to_email,
          ticket_status,
          assigned_at,
          created_at,
          assigned_user:user_profiles!event_tickets_assigned_to_user_id_fkey(
            display_name,
            email
          )
        `
        )
        .eq("event_id", eventId)
        .eq("purchased_by_user_id", user?.id)
        .order("created_at", { ascending: true })
        .overrideTypes<EventTicket[]>();

      if (updatedTickets) {
        setTickets(updatedTickets);
      }

      // Clear the email input for this specific ticket
      setTicketEmails(prev => ({ ...prev, [ticketId]: "" }));
      toast({
        title: "Success",
        description: `Ticket assigned to ${ticketEmail}. An invitation email has been sent.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssigning(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unassigned":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Unassigned
          </Badge>
        );
      case "assigned":
        return (
          <Badge variant="default">
            <UserIcon className="h-3 w-3 mr-1" />
            Assigned
          </Badge>
        );
      case "used":
        return (
          <Badge variant="destructive">
            <CheckCircle className="h-3 w-3 mr-1" />
            Used
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading tickets...</span>
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Tickets Found
          </h3>
          <p className="text-gray-600">
            You haven&apos;t purchased any tickets for this event yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const unassignedTickets = tickets.filter(
    (t) => t.ticket_status === "unassigned"
  );
  const assignedTickets = tickets.filter(
    (t) => t.ticket_status !== "unassigned"
  );

  return (
    <div className="space-y-6">
      {/* Unassigned Tickets */}
      {unassignedTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Ticket className="h-5 w-5" />
              <span>Available Tickets ({unassignedTickets.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You can assign these tickets to friends or colleagues by
                entering their email address. They&apos;ll receive an invitation to
                claim their ticket.
              </AlertDescription>
            </Alert>

            {unassignedTickets.map((ticket) => (
              <div key={ticket.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Ticket className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">
                      Ticket #{ticket.id.slice(-8)}
                    </span>
                    {getStatusBadge(ticket.ticket_status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Purchased {new Date(ticket.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <Label htmlFor={`email-${ticket.id}`}>
                      Assign to Email
                    </Label>
                    <Input
                      id={`email-${ticket.id}`}
                      type="email"
                      placeholder="Enter email address"
                      value={ticketEmails[ticket.id] || ""}
                      onChange={(e) => 
                        setTicketEmails(prev => ({ 
                          ...prev, 
                          [ticket.id]: e.target.value 
                        }))
                      }
                      disabled={assigning === ticket.id}
                    />
                  </div>
                  <Button
                    onClick={() => assignTicket(ticket.id)}
                    disabled={assigning === ticket.id || !ticketEmails[ticket.id]?.trim()}
                    className="w-full"
                  >
                    {assigning === ticket.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assigned Tickets */}
      {assignedTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserIcon className="h-5 w-5" />
              <span>Assigned Tickets ({assignedTickets.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignedTickets.map((ticket) => (
                <div key={ticket.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Ticket className="h-4 w-4 text-green-600" />
                      <span className="font-medium">
                        Ticket #{ticket.id.slice(-8)}
                      </span>
                      {getStatusBadge(ticket.ticket_status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Assigned{" "}
                      {ticket.assigned_at
                        ? new Date(ticket.assigned_at).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>
                      Assigned to: <strong>{ticket.assigned_to_email}</strong>
                    </span>
                    {ticket.assigned_user && (
                      <span className="text-green-600">
                        (Claimed by{" "}
                        {ticket.assigned_user.display_name ||
                          ticket.assigned_user.email}
                        )
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {tickets.length}
              </div>
              <div className="text-sm text-gray-600">Total Tickets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {unassignedTickets.length}
              </div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {tickets.filter((t) => t.ticket_status === "assigned").length}
              </div>
              <div className="text-sm text-gray-600">Assigned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {tickets.filter((t) => t.ticket_status === "used").length}
              </div>
              <div className="text-sm text-gray-600">Used</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
