import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ApprovalStatus, EventVisibility } from "@/lib/types";

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

    const { data: loggedInUser } = await supabase.auth.getUser();
    if (loggedInUser.user?.id === userId) {
      fetchDraftProjects = "submitted.eq.false,submitted.eq.true";
    }

    // Fetch user profile including all social media and profile fields
    // Using * to select all columns for resilience if some columns don't exist yet
    const { data: profile, error: profileError } = await serviceSupabase
      .from("user_profiles")
      .select("*")
      .eq("uid", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        {
          error: "Failed to fetch user profile",
          details: profileError.message,
          code: profileError.code,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const avatarUrl = profile?.avatar_url || null;

    // Fetch phone number from user_phone_numbers table
    // Only fetch phone numbers for the user's own profile (privacy)
    let primaryPhoneNumber: string | null = null;
    const isOwnProfile = loggedInUser.user?.id === userId;

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

    // Fetch projects where user is lead
    const { data: leadProjects, error: leadError } = await supabase
      .from("projects")
      .select(
        `
        id,
        project_name,
        project_description,
        lead_name,
        lead_email,
        teammates,
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
      .eq("lead_email", profile.email)
      .or(fetchDraftProjects);

    if (leadError) {
      console.error("Error fetching lead projects:", leadError);
      return NextResponse.json(
        { error: "Failed to fetch lead projects" },
        { status: 500 }
      );
    }

    // Fetch projects where user is teammate
    const { data: teamProjects, error: teamError } = await supabase
      .from("projects")
      .select(
        `
        id,
        project_name,
        project_description,
        lead_name,
        lead_email,
        teammates,
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
      .contains("teammates", [profile.email])
      .or(fetchDraftProjects);

    if (teamError) {
      console.error("Error fetching team projects:", teamError);
      return NextResponse.json(
        { error: "Failed to fetch team projects" },
        { status: 500 }
      );
    }

    // Combine and deduplicate projects
    const allProjects = [...(leadProjects || []), ...(teamProjects || [])]
      .filter(
        (project, index, self) =>
          index === self.findIndex((p) => p.id === project.id)
      )
      .map((project) => ({
        id: project.id,
        project_name: project.project_name,
        project_description: project.project_description,
        lead_name: project.lead_name,
        lead_email: project.lead_email,
        teammates: project.teammates,
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
      }));

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

    // Return profile with avatar_url and phone_number included
    const profileWithAvatar = {
      ...profile,
      avatar_url: avatarUrl,
      phone_number: primaryPhoneNumber,
    };

    return NextResponse.json({
      profile: profileWithAvatar,
      projects: allProjects,
      events: events || [],
    });
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
