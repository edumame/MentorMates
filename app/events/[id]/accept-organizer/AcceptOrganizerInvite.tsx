"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { EventRole } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import { Shield, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface AcceptOrganizerInviteProps {
  eventId: string;
  eventName: string;
  eventBlurb: string | null;
  eventSlug: string | null;
  invitedEmail?: string;
  eventNotFound?: boolean;
}

export function  AcceptOrganizerInvite({
  eventId,
  eventName,
  eventBlurb,
  eventSlug,
  invitedEmail,
  eventNotFound = false,
}: AcceptOrganizerInviteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasAccepted, setHasAccepted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(!!session);
      setUser(session?.user || null);

      // If user is authenticated, check if they're already an organizer
      if (session) {
        const { data: existingRole } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("event_id", eventId)
          .maybeSingle();

        if (existingRole?.role === EventRole.Organizer) {
          // Already an organizer, redirect
          const overviewUrl = `/events/${eventSlug || eventId}/overview`;
          router.push(overviewUrl);
        }
      }
    };

    checkAuth();
  }, [eventId, eventSlug, router]);

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    localStorage.setItem(
      "returnUrl",
      window.location.pathname + window.location.search
    );
    router.push("/login");
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      handleLogin();
      return;
    }

    setIsLoading(true);

    try {
      // Get user's email
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("uid", user.id)
        .single();

      if (!userProfile) {
        toast({
          title: "Error",
          description: "User profile not found",
          variant: "destructive",
        });
        return;
      }

      const userEmail = userProfile.email.toLowerCase();

      // If an invited email was specified, verify it matches
      if (invitedEmail && userEmail !== invitedEmail.toLowerCase()) {
        toast({
          title: "Email Mismatch",
          description: `This invitation was sent to ${invitedEmail}. Please sign in with that email address or contact the event organizer.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Add user as organizer
      const { error } = await supabase.from("user_event_roles").upsert(
        {
          user_id: user.id,
          event_id: eventId,
          role: EventRole.Organizer,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );

      if (error) {
        toast({
          title: "Error",
          description: "Failed to accept organizer invitation",
          variant: "destructive",
        });
        return;
      }

      setHasAccepted(true);

      // Redirect to event overview after a short delay
      setTimeout(() => {
        const overviewUrl = `/events/${eventSlug || eventId}/overview`;
        router.push(overviewUrl);
      }, 2000);
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (eventNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 py-8 px-4">
        <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 text-center max-w-2xl w-full">
            <div className="mb-6 flex justify-center">
              <div className="bg-red-100 rounded-full p-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Event Link Changed
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              The event link you&apos;re trying to access has been changed or no longer exists.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-semibold text-red-900 mb-3">
                What to do next:
              </h3>
              <ul className="space-y-2 text-red-800">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Contact the event organizer to request a new invitation link</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Check if you received a more recent invitation email</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Verify that you&apos;re using the correct link</span>
                </li>
              </ul>
            </div>
            {invitedEmail && (
              <p className="text-sm text-gray-500 mb-6">
                This invitation was sent to{" "}
                <span className="font-medium text-gray-700">{invitedEmail}</span>
              </p>
            )}
            <Button
              onClick={() => router.push("/")}
              size="lg"
              variant="outline"
              className="w-full rounded-full px-6 py-6 text-lg"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (hasAccepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
        <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 text-center max-w-2xl w-full">
            <div className="mb-6 flex justify-center">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Welcome to the Team!
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              You&apos;ve successfully accepted the organizer invitation for{" "}
              <span className="font-semibold text-blue-700">{eventName}</span>.
            </p>
            <p className="text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to event dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 text-center max-w-2xl w-full">
          <div className="mb-8">
            <div className="mb-6 flex justify-center">
              <div className="bg-blue-100 rounded-full p-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              You&apos;re invited to organize
            </h1>
            <h2 className="text-2xl sm:text-3xl font-semibold text-blue-700 mb-4">
              {eventName}
            </h2>

            {eventBlurb && (
              <p className="max-w-xl mx-auto mb-8 text-gray-600 text-lg leading-relaxed">
                {eventBlurb}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-3">
                As an organizer, you&apos;ll have access to:
              </h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Event management dashboard</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Participant and project management</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Communication tools to send updates</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Analytics and reporting features</span>
                </li>
              </ul>
            </div>

            {invitedEmail && (
              <p className="text-sm text-gray-500 mb-6">
                This invitation was sent to{" "}
                <span className="font-medium text-gray-700">{invitedEmail}</span>
              </p>
            )}
          </div>

          <div className="space-y-4">
            {!isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm mb-4">
                  Sign in or create an account to accept this invitation
                </p>
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="w-full rounded-full px-6 py-6 text-lg"
                >
                  Sign In to Accept Invitation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm mb-4">
                  Signed in as <span className="font-medium">{user?.email}</span>
                </p>
                <Button
                  onClick={handleAcceptInvite}
                  disabled={isLoading}
                  size="lg"
                  className="w-full rounded-full px-6 py-6 text-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Accepting Invitation...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Accept Organizer Invitation
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
