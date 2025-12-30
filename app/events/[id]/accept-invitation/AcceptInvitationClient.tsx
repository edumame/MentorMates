"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Event {
  event_id: string;
  event_name: string;
  event_date: string;
  location: string | null;
  event_blurb: string | null;
  cover_image_url: string | null;
  slug: string | null;
}

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  status: string;
  expires_at: string | null;
}

interface AcceptInvitationClientProps {
  event: Event;
  invitation: Invitation;
  token: string;
  isLoggedIn?: boolean;
  error?: "expired" | "invalid_status" | null;
}

export function AcceptInvitationClient({
  event,
  invitation,
  token,
  isLoggedIn = false,
  error = null,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const eventSlug = event.slug || event.event_id;
  const displayName = invitation.name || invitation.first_name || invitation.email.split("@")[0];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    setAcceptError(null);

    try {
      const response = await fetch(`/api/invitations/accept/${token}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Redirect to event page
      router.push(`/events/${eventSlug}?welcome=true`);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Something went wrong");
      setIsAccepting(false);
    }
  };

  // Error states
  if (error === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-amber-50 to-white">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation link has expired. Please contact the event organizers to request a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href={`/events/${eventSlug}`}>View Event</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "invalid_status") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-red-50 to-white">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation is no longer valid. It may have been cancelled or already used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href={`/events/${eventSlug}`}>View Event</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login required state
  if (!isLoggedIn) {
    const returnUrl = `/events/${eventSlug}/accept-invitation?token=${token}`;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-white">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {event.cover_image_url && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden mb-4">
                <Image
                  src={event.cover_image_url}
                  alt={event.event_name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <CardTitle className="text-xl">You&apos;re Invited!</CardTitle>
            <CardDescription>
              Hi {displayName}, you&apos;ve been invited to join {event.event_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Event Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">{event.event_name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span>{formatDate(event.event_date)}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.event_blurb && (
                <p className="text-sm text-muted-foreground mt-2">
                  {event.event_blurb}
                </p>
              )}
            </div>

            {/* Auth Actions */}
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Sign in or create an account to accept this invitation
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}>
                    Sign In
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}&mode=signup`}>
                    Create Account
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in - can accept
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-50 to-white">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {event.cover_image_url && (
            <div className="relative w-full h-32 rounded-lg overflow-hidden mb-4">
              <Image
                src={event.cover_image_url}
                alt={event.event_name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-xl">Accept Invitation</CardTitle>
          <CardDescription>
            You&apos;re invited to join {event.event_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Event Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">{event.event_name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <span>{formatDate(event.event_date)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {acceptError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{acceptError}</span>
            </div>
          )}

          {/* Accept Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting ? "Joining..." : "Accept & Join Event"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By accepting, you&apos;ll be added as a participant for this event.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

