"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { validateEmailInviteHash } from "@/lib/utils/invite-links";

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

export default function JoinProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const hash = searchParams.get("hash");

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
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
    if (!projectId) {
      setError("No project ID provided");
      setLoading(false);
      return;
    }

    if (!hash) {
      setError("Invalid invitation link. Please use the link from your invitation email.");
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

    try {
      // Get user's email
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("uid", user.id)
        .single();

      if (!userProfile) {
        setError("User profile not found");
        return;
      }

      const userEmail = userProfile.email.toLowerCase();
      
      // Verify the hash matches the user's email
      if (hash && !validateEmailInviteHash(projectId!, userEmail, hash)) {
        setError("This invitation link was sent to a different email address. Please sign in with the invited email or contact the project lead.");
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

      // Call unified accept endpoint to handle event join + teammate add
      const resp = await fetch("/api/projects/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId, hash }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Failed to join project");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(data.redirectUrl || `/projects/${projectId}`);
      }, 1200);
    } catch {
      setError("Failed to join project. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-900" />
          <span>Loading project information...</span>
        </div>
      </div>
    );
  }

  if (error && !project) {
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
                  <AlertDescription>{error}</AlertDescription>
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
                      disabled={joining}
                      className="w-full"
                    >
                      {joining ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-900" />
                          Joining Project...
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-2" />
                          Join This Project
                        </>
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
