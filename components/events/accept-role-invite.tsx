"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { EventRole } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { canAccessRole } from "@/features/user/roles/roles";

interface AcceptRoleInviteProps {
  eventId: string;
  eventName: string;
  eventBlurb: string | null;
  eventSlug: string | null;
  invitedEmail?: string;
  eventNotFound?: boolean;
  role: EventRole.Participant | EventRole.Judge | EventRole.Organizer;
}

interface RoleInviteContent {
  icon: LucideIcon;
  heading: string;
  acceptedHeading: string;
  acceptedDescription: string;
  redirectLabel: string;
  benefitsHeading: string;
  benefits: string[];
  acceptButtonLabel: string;
}

const ROLE_CONTENT: Record<
  AcceptRoleInviteProps["role"],
  RoleInviteContent
> = {
  [EventRole.Participant]: {
    icon: Users,
    heading: "You're invited to join",
    acceptedHeading: "You're In!",
    acceptedDescription:
      "You've successfully accepted the participant invitation for",
    redirectLabel: "Redirecting to event overview...",
    benefitsHeading: "As a participant, you'll have access to:",
    benefits: [
      "Event updates, schedule, and resources",
      "Project submission and collaboration tools",
      "Announcements from organizers and judges",
      "Your event dashboard after you sign in",
    ],
    acceptButtonLabel: "Accept Participant Invitation",
  },
  [EventRole.Judge]: {
    icon: Scale,
    heading: "You're invited to judge",
    acceptedHeading: "Judge Invitation Accepted!",
    acceptedDescription: "You've successfully accepted the judge invitation for",
    redirectLabel: "Redirecting to judge experience...",
    benefitsHeading: "As a judge, you'll have access to:",
    benefits: [
      "The event overview and judging schedule",
      "Project review and scoring workflows",
      "Assigned submissions once organizers publish them",
      "A judge-specific dashboard after you sign in",
    ],
    acceptButtonLabel: "Accept Judge Invitation",
  },
  [EventRole.Organizer]: {
    icon: Shield,
    heading: "You're invited to organize",
    acceptedHeading: "Welcome to the Team!",
    acceptedDescription:
      "You've successfully accepted the organizer invitation for",
    redirectLabel: "Redirecting to event dashboard...",
    benefitsHeading: "As an organizer, you'll have access to:",
    benefits: [
      "Event management dashboard",
      "Participant and project management",
      "Communication tools to send updates",
      "Analytics and reporting features",
    ],
    acceptButtonLabel: "Accept Organizer Invitation",
  },
};

const ROLE_ACCENT_CLASSES: Record<
  AcceptRoleInviteProps["role"],
  {
    background: string;
    icon: string;
    panel: string;
    panelBorder: string;
    heading: string;
    body: string;
  }
> = {
  [EventRole.Participant]: {
    background: "bg-sky-100",
    icon: "text-sky-600",
    panel: "bg-sky-50",
    panelBorder: "border-sky-200",
    heading: "text-sky-900",
    body: "text-sky-800",
  },
  [EventRole.Judge]: {
    background: "bg-orange-100",
    icon: "text-orange-600",
    panel: "bg-orange-50",
    panelBorder: "border-orange-200",
    heading: "text-orange-900",
    body: "text-orange-800",
  },
  [EventRole.Organizer]: {
    background: "bg-blue-100",
    icon: "text-blue-600",
    panel: "bg-blue-50",
    panelBorder: "border-blue-200",
    heading: "text-blue-900",
    body: "text-blue-800",
  },
};

export function AcceptRoleInvite({
  eventId,
  eventName,
  eventBlurb,
  eventSlug,
  invitedEmail,
  eventNotFound = false,
  role,
}: AcceptRoleInviteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasAccepted, setHasAccepted] = useState(false);
  const router = useRouter();

  const content = ROLE_CONTENT[role];
  const accent = ROLE_ACCENT_CLASSES[role];
  const Icon = content.icon;

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(!!session);
      setUser(session?.user || null);

      if (session) {
        const { data: existingRole } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("event_id", eventId)
          .maybeSingle();

        const currentRole = existingRole?.role as EventRole | undefined;
        if (currentRole && canAccessRole(currentRole, role)) {
          const overviewUrl = `/events/${eventSlug || eventId}/overview`;
          router.push(overviewUrl);
        }
      }
    };

    checkAuth();
  }, [eventId, eventSlug, role, router]);

  const handleLogin = () => {
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
      const userEmail = user.email?.toLowerCase();
      if (!userEmail) {
        toast({
          title: "Error",
          description: "User profile not found",
          variant: "destructive",
        });
        return;
      }

      if (invitedEmail && userEmail !== invitedEmail.toLowerCase()) {
        toast({
          title: "Email Mismatch",
          description: `This invitation was sent to ${invitedEmail}. Please sign in with that email address or contact the event organizer.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data: existingRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .maybeSingle();

      const currentRole = existingRole?.role as EventRole | undefined;
      if (currentRole && canAccessRole(currentRole, role)) {
        router.push(`/events/${eventSlug || eventId}/overview`);
        return;
      }

      const { error } = await supabase.from("user_event_roles").upsert(
        {
          user_id: user.id,
          event_id: eventId,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );

      if (error) {
        toast({
          title: "Error",
          description: `Failed to accept ${role} invitation`,
          variant: "destructive",
        });
        return;
      }

      setHasAccepted(true);

      setTimeout(() => {
        router.push(`/events/${eventSlug || eventId}/overview`);
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 px-4 py-8">
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl md:p-12">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Event Link Changed
            </h1>
            <p className="mb-6 text-lg text-gray-600">
              The event link you&apos;re trying to access has been changed or no
              longer exists.
            </p>
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 text-left">
              <h3 className="mb-3 font-semibold text-red-900">What to do next:</h3>
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
              <p className="mb-6 text-sm text-gray-500">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 py-8">
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl md:p-12">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              {content.acceptedHeading}
            </h1>
            <p className="mb-4 text-lg text-gray-600">
              {content.acceptedDescription}{" "}
              <span className="font-semibold text-blue-700">{eventName}</span>.
            </p>
            <p className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {content.redirectLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 py-8">
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl md:p-12">
          <div className="mb-8">
            <div className="mb-6 flex justify-center">
              <div className={`rounded-full p-4 ${accent.background}`}>
                <Icon className={`h-12 w-12 ${accent.icon}`} />
              </div>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              {content.heading}
            </h1>
            <h2 className={`mb-4 text-2xl font-semibold sm:text-3xl ${accent.icon}`}>
              {eventName}
            </h2>

            {eventBlurb && (
              <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-gray-600">
                {eventBlurb}
              </p>
            )}

            <div
              className={`mb-6 rounded-lg border p-6 text-left ${accent.panel} ${accent.panelBorder}`}
            >
              <h3 className={`mb-3 font-semibold ${accent.heading}`}>
                {content.benefitsHeading}
              </h3>
              <ul className={`space-y-2 ${accent.body}`}>
                {content.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {invitedEmail && (
              <p className="mb-6 text-sm text-gray-500">
                This invitation was sent to{" "}
                <span className="font-medium text-gray-700">{invitedEmail}</span>
              </p>
            )}
          </div>

          <div className="space-y-4">
            {!isAuthenticated ? (
              <div className="space-y-3">
                <p className="mb-4 text-sm text-gray-600">
                  Sign in or create an account to accept this invitation.
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
                <p className="mb-4 text-sm text-gray-600">
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
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Accepting Invitation...
                    </>
                  ) : (
                    <>
                      <Icon className="mr-2 h-5 w-5" />
                      {content.acceptButtonLabel}
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
