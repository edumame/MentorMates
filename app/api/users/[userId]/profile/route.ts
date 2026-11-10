import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ApprovalStatus, EventVisibility } from "@/lib/types";
import { presentProfile, publicDisplayName, publicTeammateLabels } from "@/lib/users/profile-presentation";
import { getTeamEmails, type TeamEmails } from "@/lib/projects/membership";
import { fetchPublicTeamRosters } from "@/lib/projects/team-members";

type ProfileProjectRow = {
  id: string;
  project_name: string | null;
  project_description: string | null;
  lead_name: string | null;
  project_url: string | null;
  cover_image_url: string | null;
  event_id: string | null;
  created_at: string | null;
  submitted: boolean | null;
  project_tracks: Array<{ event_tracks: Array<{ track_id: string; name: string }> | null }> | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const serviceSupabase = createSupabaseServiceClient();
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // build query to fetch draft projects if the user is the logged in user
    let fetchDraftProjects = "submitted.eq.true";

    const { data: loggedInUser, error: authError } = await supabase.auth.getUser();
    const isOwnProfile = !authError && loggedInUser.user?.id === userId;
    if (isOwnProfile) {
      fetchDraftProjects = "submitted.eq.false,submitted.eq.true";
    }

    // Keep internal wildcard compatibility for optional deployed fields such as
    // cover_image_url. presentProfile is the strict public/owner output boundary.
    const { data: profile, error: profileError } = await serviceSupabase
      .from("user_profiles")
      .select("*")
      .eq("uid", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Fetch phone number from user_phone_numbers table
    // Only fetch phone numbers for the user's own profile (privacy)
    let primaryPhoneNumber: string | null = null;

    if (isOwnProfile) {
      // Prefer verified phone number, otherwise get the most recent one
      // First try to get a verified phone number
      const { data: verifiedPhones, error: verifiedError } = await supabase
        .from("user_phone_numbers")
        .select("phone_number")
        .eq("user_id", userId)
        .eq("verification_status", "verified")
        .order("created_at", { ascending: false })
        .limit(1);

      if (verifiedError) {
        console.error("Error fetching verified phone number:", verifiedError);
      }

      if (verifiedPhones && verifiedPhones.length > 0) {
        primaryPhoneNumber = verifiedPhones[0].phone_number;
      } else {
        // If no verified phone, get the most recent one
        const { data: recentPhones, error: recentError } = await supabase
          .from("user_phone_numbers")
          .select("phone_number")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (recentError) {
          console.error("Error fetching phone number:", recentError);
          // Don't fail the request if phone number fetch fails
        }

        if (recentPhones && recentPhones.length > 0) {
          primaryPhoneNumber = recentPhones[0].phone_number;
        }
      }
    }

    // Membership is resolved server-side from the profile owner's verified
    // auth email (project_ids_for_user, service role). The project rows are
    // then read with the caller's client, so projects RLS still decides which
    // (private) projects this viewer may see, and only client-readable
    // columns are selected (team emails are not readable by anon/auth roles).
    const { data: memberRows, error: memberError } = await serviceSupabase.rpc(
      "project_ids_for_user" as never,
      { p_user_id: userId } as never
    );
    if (memberError) {
      console.error("Error resolving profile projects:", memberError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }
    const memberProjectIds = ((memberRows ?? []) as Array<string | { project_ids_for_user: string }>).map(
      (row) => (typeof row === "string" ? row : row.project_ids_for_user)
    );

    const { data: projectRows, error: projectsError } = memberProjectIds.length
      ? await supabase
          .from("projects")
          .select(
            `
        id,
        project_name,
        project_description,
        lead_name,
        project_url,
        cover_image_url,
        event_id,
        created_at,
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        ),
        submitted
      `
          )
          .in("id", memberProjectIds)
          .or(fetchDraftProjects)
      : { data: [], error: null };

    if (projectsError) {
      console.error("Error fetching profile projects:", projectsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    // The owner sees their own teams' emails; everyone else sees generic
    // labels (team size from the server-side roster, no emails).
    const visibleIds = ((projectRows ?? []) as unknown as ProfileProjectRow[]).map((row) => row.id);
    const [ownTeamEmails, rosters] = await Promise.all([
      isOwnProfile
        ? getTeamEmails(supabase, visibleIds)
        : Promise.resolve(new Map<string, TeamEmails>()),
      fetchPublicTeamRosters(visibleIds),
    ]);
    const profileProjects = ((projectRows ?? []) as unknown as ProfileProjectRow[]).map(
      (project) => {
        const emails = ownTeamEmails.get(project.id);
        const teammateCount =
          rosters.get(project.id)?.members.filter((member) => member.role === "member").length ?? 0;
        return {
          ...project,
          lead_email: emails?.lead_email ?? null,
          teammates: emails?.teammates ?? Array.from({ length: teammateCount }, () => ""),
        };
      }
    );

    // Combine and deduplicate projects
    const allProjects = profileProjects
      .filter(
        (project, index, self) =>
          index === self.findIndex((p) => p.id === project.id)
      )
      .map((project) => {
        const canViewMemberIdentities = isOwnProfile && Boolean(project.lead_email);
        return {
        id: project.id,
        project_name: project.project_name,
        project_description: project.project_description,
        lead_name: canViewMemberIdentities ? project.lead_name : publicDisplayName(project.lead_name, "Project lead"),
        ...(canViewMemberIdentities ? { lead_email: project.lead_email } : {}),
        teammates: canViewMemberIdentities ? project.teammates : publicTeammateLabels(project.teammates),
        project_url: project.project_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        created_at: project.created_at,
        track_ids:
          project.project_tracks
            ?.map((pt) => pt.event_tracks?.[0]?.track_id)
            .filter(Boolean) || [],
        tracks:
          project.project_tracks
            ?.map((pt) => ({
              track_id: pt.event_tracks?.[0]?.track_id || "",
              name: pt.event_tracks?.[0]?.name || "",
              event_id: project.event_id,
              description: "",
              scoring_criteria: {
                name: pt.event_tracks?.[0]?.name || "",
                criteria: [],
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            .filter(Boolean) || [],
          submitted: project.submitted,
      };
      });

    // Fetch events where user has roles
    // If the logged-in user is viewing their own profile, show all events where the user has a role
    // Otherwise, only show public and approved events where the user has a role
    const visibilityFilter = isOwnProfile
      ? [
          EventVisibility.Public,
          EventVisibility.Private,
          EventVisibility.Draft,
          EventVisibility.Archived,
          EventVisibility.Test,
          EventVisibility.Demo,
        ]
      : [EventVisibility.Public];
    const approvalFilter = isOwnProfile
      ? [
          ApprovalStatus.Approved,
          ApprovalStatus.NotSubmitted,
          ApprovalStatus.Submitted,
          ApprovalStatus.Rejected,
        ]
      : [ApprovalStatus.Approved];

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        `
        event_id,
        event_name,
        event_type,
        slug,
        event_date,
        location,
        event_blurb,
        event_description,
        visibility,
        cover_image_url,
        scoring_config,
        role_labels,
        user_event_roles!inner (
          role
        ),
        approval_status
      `
      )
      .eq("user_event_roles.user_id", userId)
      .in("visibility", visibilityFilter)
      .in("approval_status", approvalFilter);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // Fetch prizes for all projects
    if (allProjects.length > 0) {
      const projectIds = allProjects.map((p) => p.id);
      const { data: prizesData, error: prizesError } = await supabase
        .from("prize_winners")
        .select(
          `
          id,
          prize_id,
          project_id
          `
        )
        .in("project_id", projectIds);

      if (prizesError) {
        console.error("Error fetching prizes:", prizesError);
        return NextResponse.json(
          { error: "Failed to fetch prizes" },
          { status: 500 }
        );
      }

      // Group prizes by project_id
      const prizesByProject = (prizesData || []).reduce(
        (acc, prize) => {
          const projectId = prize.project_id!;
          if (!acc[projectId]) acc[projectId] = [];
          acc[projectId].push(prize);
          return acc;
        },
        {} as Record<string, typeof prizesData>
      );

      // Add prizes to projects
      allProjects.forEach((project: { id: string; [key: string]: unknown }) => {
        (project as { prizes_won?: Record<string, unknown>[] }).prizes_won =
          prizesByProject[project.id] || [];
      });
    }

    return NextResponse.json({
      profile: presentProfile(profile, isOwnProfile, primaryPhoneNumber),
      projects: allProjects,
      events: events || [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
