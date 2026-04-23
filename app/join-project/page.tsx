"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, CheckCircle, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface ProjectInfo {
  id: string;
  project_name: string;
  project_description: string | null;
  lead_name: string;
  lead_email: string;
  teammates: string[] | null;
  event_id: string | null;
  event?: {
    event_name: string;
    event_date: string;
  } | null;
}

function JoinProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const token = searchParams.get("token");

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [validatingToken, setValidatingToken] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [eventRegistrationHref, setEventRegistrationHref] = useState<string | null>(null);

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
    if (!projectId) {
      setError("No project ID provided");
      setLoading(false);
      return;
    }

    const fetchProject = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(
            `
            id,
            project_name,
            project_description,
            lead_name,
            lead_email,
            teammates,
            event_id,
            event:events(
              event_name,
              event_date
            )
          `
          )
          .eq("id", projectId)
          .single();

        if (projectError || !projectData) {
          setError("Project not found");
          return;
        }

        // Handle the event data - Supabase returns it as an array from the join
        const eventData = Array.isArray(projectData.event) && projectData.event.length > 0
          ? projectData.event[0]
          : null;

        setProject({
          ...projectData,
          event: eventData
        });
      } catch {
        setError("Failed to load project information");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (!token) {
      setTokenValid(null);
      setInviteError(null);
      setInvitedEmail(null);
      return;
    }

    if (!projectId) {
      return;
    }

    const verifyToken = async () => {
      setValidatingToken(true);
      try {
        const response = await fetch("/api/projects/verify-invite-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, projectId }),
        });

        const data = await response.json();

        if (response.ok && data.valid) {
          setTokenValid(true);
          setInvitedEmail(data.email);
          setInviteError(null);
        } else {
          setTokenValid(false);
          setInviteError(data.error || "Invalid or expired invitation link");
        }
      } catch {
        setTokenValid(false);
        setInviteError("Failed to verify invitation link");
      } finally {
        setValidatingToken(false);
      }
    };

    verifyToken();
  }, [token, projectId]);

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    localStorage.setItem(
      "returnUrl",
      window.location.pathname + window.location.search
    );
    router.push("/login");
  };

  const joinProject = async () => {
    if (!user || !project) return;

    setJoining(true);
    setError(null);
    setEventRegistrationHref(null);

    try {
      const userEmailFromAuth = user.email?.toLowerCase();
      if (!userEmailFromAuth) {
        setError("User profile not found");
        return;
      }

      const userEmail = userEmailFromAuth;

      // If token is provided, verify the user's email matches the invited email
      if (token && tokenValid && invitedEmail) {
        if (userEmail !== invitedEmail.toLowerCase()) {
          setError(
            `This invitation was sent to ${invitedEmail}. You are signed in as ${userEmail}. Please sign in with the correct account.`
          );
          return;
        }
      }

      // If token is not provided or invalid, show warning
      if (token && !tokenValid) {
        setError("Invalid or expired invitation link. Please request a new invitation.");
        return;
      }
      
      // Check if user is already the project lead
      if (project.lead_email === userEmail) {
        setError("You are already the project lead");
        return;
      }

      // Check if user is already a teammate
      if (project.teammates?.includes(userEmail)) {
        setError("You are already a member of this project");
        return;
      }

      // If project is part of an event, ensure user is registered for the event
      if (project.event_id) {
        const { data: userRole } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("event_id", project.event_id)
          .maybeSingle();

        if (!userRole) {
          setEventRegistrationHref(`/events/${project.event_id}/overview`);
          setError(
            "You must be registered for the event to join this project. Please register for the event first."
          );
          return;
        }
      }

      const response = await fetch("/api/projects/join", {
        method: "PUT",
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to join project.");
      }

      setSuccess(true);

      // Redirect to project page after a short delay
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 2000);
    } catch {
      setError("Failed to join project. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (!loading && error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Project Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/projects")} className="w-full">
              Browse Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Successfully Joined!</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You have successfully joined <strong>{project?.project_name}</strong>.
              You will be redirected to the project page shortly.
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
            <Users className="h-6 w-6" />
            <span>Join Project Team</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {project && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {project.project_name || "Untitled Project"}
                </h3>
                {project.event && (
                  <p className="text-sm text-gray-500">
                    Part of {project.event.event_name}
                  </p>
                )}
              </div>

              {project.project_description && (
                <p className="text-gray-700 text-sm">
                  {project.project_description}
                </p>
              )}

              {token && validatingToken && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <AlertDescription className="flex items-center gap-2">
                    <span>Validating invitation link...</span>
                  </AlertDescription>
                </Alert>
              )}

              {token && !validatingToken && tokenValid === false && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>
                    {inviteError || "This invitation link is invalid or has expired. Please request a new invitation link."}
                  </AlertDescription>
                </Alert>
              )}

              {token && !validatingToken && tokenValid === true && invitedEmail && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Valid invitation for <strong>{invitedEmail}</strong>. Please sign in with this email to join.
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You&apos;ve been invited by <strong>{project.lead_name}</strong> to
                  join this project as a teammate.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span>{error}</span>
                    {eventRegistrationHref && (
                      <span>
                        {" "}
                        <Link
                          href={eventRegistrationHref}
                          className="underline font-medium"
                        >
                          Register for the event
                        </Link>
                        .
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-4">
                {!user ? (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                      You need to sign in to join this project.
                    </p>
                    <Button onClick={handleLogin} className="w-full">
                      Sign In to Join Project
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                      Signed in as <strong>{user.email}</strong>
                    </p>
                    <Button
                      onClick={joinProject}
                      disabled={joining || validatingToken || (token !== null && tokenValid === false)}
                      className="w-full"
                    >
                      {joining ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-900" />
                          Joining Project...
                        </>
                      ) : validatingToken ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-900" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-2" />
                          Join This Project
                        </>
                      )}
                    </Button>
                    {token && !validatingToken && tokenValid === false && (
                      <p className="text-sm text-red-600 text-center">
                        This invitation link is invalid. Please request a new one.
                      </p>
                    )}
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

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-900" />
        <span>Loading project information...</span>
      </div>
    </div>
  );
}

export default function JoinProjectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <JoinProjectContent />
    </Suspense>
  );
}
