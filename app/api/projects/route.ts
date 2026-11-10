import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  EventRole,
  EventSubmissionField,
  EventTrack,
  Prize,
  ProjectFromDatabase,
  ProjectSubmissionAnswer,
  ProjectWithPrizes,
} from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { createContextusProject } from "@/lib/integrations/contextus";
import { buildArtifactsFromLegacy } from "@/features/projects/utils/submission";
import { applyEffectiveSubmissionToProject } from "@/features/projects/utils/effectiveSubmission";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { ExportMemberProfile } from "@/features/user/dashboards/dashboard/organizer/submissions/export";
import {
  buildProjectTeamMembers,
  fetchPublicTeamRosters,
} from "@/lib/projects/team-members";
import { getTeamEmails } from "@/lib/projects/membership";
import { PROJECT_CLIENT_COLUMNS } from "@/lib/projects/columns";

type ArtifactRow = {
  project_id: string;
  id: string;
  kind: "project_link" | "video_link" | "additional_material";
  label: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

type OrganizerProjectRow = {
  id: string;
  project_tracks?: { track_id: string }[] | null;
  project_url?: string | null;
  additional_materials_url?: string | null;
  video_url?: string | null;
  [key: string]: unknown;
};

type SubmissionAnswerRow = ProjectSubmissionAnswer;

async function fetchSubmissionFieldsByEventIds(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  eventIds: string[]
) {
  if (eventIds.length === 0) {
    return new Map<string, EventSubmissionField[]>();
  }

  const { data, error } = await supabase
    .from("event_submission_fields")
    .select("*")
    .in("event_id", eventIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return new Map<string, EventSubmissionField[]>();
  }

  const map = new Map<string, EventSubmissionField[]>();
  for (const row of data as EventSubmissionField[]) {
    const existing = map.get(row.event_id) || [];
    existing.push(row);
    map.set(row.event_id, existing);
  }

  return map;
}

async function fetchSubmissionAnswersByProjectIds(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  projectIds: string[]
) {
  if (projectIds.length === 0) {
    return new Map<string, SubmissionAnswerRow[]>();
  }

  const { data, error } = await supabase
    .from("project_submission_answers")
    .select("id, project_id, event_submission_field_id, answer")
    .in("project_id", projectIds);

  if (error || !data) {
    return new Map<string, SubmissionAnswerRow[]>();
  }

  const map = new Map<string, SubmissionAnswerRow[]>();
  for (const row of data as SubmissionAnswerRow[]) {
    const existing = map.get(row.project_id) || [];
    existing.push(row);
    map.set(row.project_id, existing);
  }

  return map;
}

async function fetchArtifactsByProjectIds(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  projectIds: string[]
) {
  if (projectIds.length === 0) {
    return new Map<string, ArtifactRow[]>();
  }

  const { data, error } = await supabase
    .from("project_artifacts")
    .select(
      "id, project_id, kind, label, url, sort_order, is_primary, metadata"
    )
    .in("project_id", projectIds)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return new Map<string, ArtifactRow[]>();
  }

  const map = new Map<string, ArtifactRow[]>();
  for (const row of data as ArtifactRow[]) {
    const existing = map.get(row.project_id) || [];
    existing.push(row);
    map.set(row.project_id, existing);
  }
  return map;
}

async function fetchTeammateProfiles(
  emails: string[]
): Promise<Map<string, ExportMemberProfile>> {
  if (emails.length === 0) return new Map();

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("user_profiles")
    .select("email, display_name, affiliation")
    .in("email", emails);

  if (error || !data) return new Map();

  return new Map(
    (data as ExportMemberProfile[]).map((profile) => [profile.email, profile])
  );
}

// Winner + finalist status for certificates. Prizes are readable through the
// caller's client (prize_winners RLS is open); round advancements are
// judge/organizer-only under RLS, so finalist status goes through the service
// client — it only ever leaks a boolean.
async function fetchCertificateExtras(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  projectId: string
): Promise<{ prizes_won: Prize[]; is_finalist: boolean }> {
  const { data: prizeRows } = await supabase
    .from("prize_winners")
    .select(
      `
        id,
        project_id,
        prizes (
          track_id,
          prize_amount,
          prize_description
        )
      `
    )
    .eq("project_id", projectId)
    .overrideTypes<
      Array<{
        id: string;
        project_id: string;
        prizes: {
          track_id: string;
          prize_amount: string;
          prize_description: string;
        } | null;
      }>
    >();

  const prizes = (prizeRows ?? []).map((row) => ({
    id: row.id,
    track_id: row.prizes?.track_id,
    prize_amount: row.prizes?.prize_amount,
    prize_description: row.prizes?.prize_description,
    winning_project_id: row.project_id,
  })) as Prize[];

  return { prizes_won: prizes, is_finalist: await fetchIsFinalist(projectId) };
}

async function fetchIsFinalist(projectId: string): Promise<boolean> {
  try {
    const serviceClient = createSupabaseServiceClient();
    const { data: advancements } = await serviceClient
      .from("project_round_advancements")
      .select("id")
      .eq("project_id", projectId)
      .limit(1);
    return (advancements?.length ?? 0) > 0;
  } catch {
    // Service key may not exist in local dev; finalist status is best-effort.
    return false;
  }
}

/**
 * Public-mode listings are open for public events. Members of a non-public
 * (e.g. private) event may use the same email-free listing — popular voting
 * and galleries call public=true for every viewer, and a members-only event
 * must not look empty to its own participants.
 */
async function canViewEventProjects(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  eventId: string | null | undefined
): Promise<boolean> {
  if (!eventId) return false;
  const { data: eventMeta, error: eventMetaError } = await supabase
    .from("events")
    .select("visibility")
    .eq("event_id", eventId)
    .maybeSingle();
  if (eventMetaError || !eventMeta) return false;
  if (eventMeta.visibility === "public") return true;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: roles, error: roleError } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .limit(1);
  return !roleError && (roles?.length ?? 0) > 0;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const eventSlugRaw = searchParams.get("eventSlug") ?? searchParams.get("event");
    const projectId = searchParams.get("projectId");
    const isPublic = searchParams.get("public") === "true";
    const submitted = searchParams.get("submitted") === "true";

    // For public views, no authentication required (guarded by visibility checks).
    if (isPublic) {
      // Prefer anon client by default (service key may not exist in local dev).
      let resolvedEventId = eventId;
      const eventSlug = eventSlugRaw?.trim() ?? null;

      // Public single-project view (e.g. logged-out project page).
      if (projectId) {
        const { data: project, error } = await supabase
          .from("projects")
          .select(
            `
            id,
            project_name,
            lead_name,
            project_description,
            project_url,
            video_url,
            additional_materials_url,
            cover_image_url,
            event_id,
            contextus_project_id,
            private,
            created_at,
            submitted,
            project_tracks (
              event_tracks (
                track_id,
                event_id,
                name,
                description,
                label,
                prize_amount,
                prize_description,
                scoring_criteria,
                created_at,
                updated_at
              )
            )
          `
          )
          .eq("id", projectId)
          .eq("submitted", true)
          .maybeSingle()
          .overrideTypes<{
            project_tracks: Array<{ event_tracks: EventTrack }>;
          }>();

        if (error || !project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Ensure the owning event is public (or the viewer belongs to it).
        // Projects whose event was deleted (event_id NULL) are governed by
        // projects RLS alone (non-private rows only for outsiders).
        if (
          project.event_id &&
          !(await canViewEventProjects(supabase, project.event_id))
        ) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        const [artifactMap, fieldMap, answerMap] = await Promise.all([
          fetchArtifactsByProjectIds(supabase, [project.id]),
          fetchSubmissionFieldsByEventIds(supabase, [project.event_id]),
          fetchSubmissionAnswersByProjectIds(supabase, [project.id]),
        ]);
        const fallbackArtifacts = buildArtifactsFromLegacy({
          project_url: project.project_url,
          additional_materials_url: project.additional_materials_url,
          video_url: (
            project as unknown as { video_url?: string | null }
          ).video_url,
        });

        const transformedProject = applyEffectiveSubmissionToProject({
          id: project.id,
          project_name: project.project_name,
          lead_name: project.lead_name,
          project_description: project.project_description,
          is_private: Boolean((project as { private?: boolean | null }).private),
          project_url: project.project_url,
          additional_materials_url: project.additional_materials_url,
          cover_image_url: project.cover_image_url,
          event_id: project.event_id,
          contextus_project_id: (
            project as unknown as { contextus_project_id?: string }
          ).contextus_project_id,
          submitted: (project as unknown as { submitted?: boolean }).submitted ?? true,
          tracks:
            project.project_tracks?.filter((pt) => Boolean(pt.event_tracks)).map(
              (pt) => pt.event_tracks
            ) || [],
          track_ids:
            project.project_tracks
              ?.map((pt) => pt.event_tracks?.track_id)
              .filter(Boolean) || [],
          created_at: project.created_at,
        },
        fieldMap.get(project.event_id) || [],
        answerMap.get(project.id),
        artifactMap.get(project.id) || fallbackArtifacts
        );

        const [extras, rosters] = await Promise.all([
          fetchCertificateExtras(supabase, project.id),
          fetchPublicTeamRosters([project.id]),
        ]);
        (transformedProject as unknown as ProjectWithPrizes).prizes_won =
          extras.prizes_won;
        (
          transformedProject as unknown as { is_finalist?: boolean }
        ).is_finalist = extras.is_finalist;

        // Public responses never carry member emails; the roster is resolved
        // server-side and carries only names and opaque member ids.
        const roster = rosters.get(project.id);
        return NextResponse.json({
          project: {
            ...transformedProject,
            team_members: roster?.members ?? [],
          },
        });
      }

      if (!resolvedEventId && eventSlug) {
        // Resolve slug -> event_id (case-insensitive exact match).
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("event_id")
          .ilike("slug", eventSlug)
          .maybeSingle();

        if (eventError) {
          console.error("Error resolving event slug:", eventError);
          return NextResponse.json(
            { error: "Failed to resolve event" },
            { status: 500 }
          );
        }

        resolvedEventId = eventData?.event_id ?? null;
      }

      if (!resolvedEventId) {
        if (eventSlug) {
          return NextResponse.json(
            {
              error: "Event not found",
              eventSlug,
            },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: "Missing required parameters" },
          { status: 400 }
        );
      }

      // Ensure the event itself is public (or the viewer belongs to it) before
      // returning any projects; projects RLS still filters per caller.
      if (!(await canViewEventProjects(supabase, resolvedEventId))) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // Public view - fetch all projects for the event
      const { data: allProjects, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          project_name,
          lead_name,
          project_description,
          project_url,
          video_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          contextus_project_id,
          private,
          created_at,
          submitted,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `
        )
        .eq("event_id", resolvedEventId)
        .eq("submitted", true)
        .order("project_name")
        .overrideTypes<
          Array<{ project_tracks: Array<{ event_tracks: EventTrack }> }>
        >();

      if (error) {
        console.error("Error fetching projects:", error);
        return NextResponse.json(
          { error: "Failed to fetch projects" },
          { status: 500 }
        );
      }

      // Public select omits lead_email/teammates (anon has no column grant).
      type PublicProjectRow = Omit<ProjectFromDatabase, "lead_email" | "teammates">;
      const projects = (allProjects || []).map((item: PublicProjectRow) => ({
        id: item.id,
        project_name: item.project_name,
        lead_name: item.lead_name,
        project_description: item.project_description,
        is_private: Boolean((item as { private?: boolean | null }).private),
        project_url: item.project_url,
        video_url: item.video_url,
        additional_materials_url: item.additional_materials_url,
        cover_image_url: item.cover_image_url,
        event_id: item.event_id,
        contextus_project_id: (
          item as unknown as { contextus_project_id?: string }
        ).contextus_project_id,
        submitted:
          (item as unknown as { submitted?: boolean }).submitted ?? true,
        tracks:
          item.project_tracks
            ?.map((pt) => pt.event_tracks)
            .filter((track): track is EventTrack => Boolean(track)) || [],
        track_ids:
          item.project_tracks
            ?.map((pt) => pt.event_tracks?.track_id)
            .filter((trackId): trackId is string => Boolean(trackId)) || [],
        created_at: item.created_at,
      }));

      const [artifactMap, fieldMap, answerMap] = await Promise.all([
        fetchArtifactsByProjectIds(
          supabase,
          projects.map((project) => project.id)
        ),
        fetchSubmissionFieldsByEventIds(supabase, [resolvedEventId]),
        fetchSubmissionAnswersByProjectIds(
          supabase,
          projects.map((project) => project.id)
        ),
      ]);
      const projectsWithArtifacts = projects.map((project) =>
        applyEffectiveSubmissionToProject(
          project,
          fieldMap.get(project.event_id) || [],
          answerMap.get(project.id),
          artifactMap.get(project.id) ||
            buildArtifactsFromLegacy({
              project_url: project.project_url,
              additional_materials_url: project.additional_materials_url,
              video_url: (project as { video_url?: string | null }).video_url,
            })
        )
      );

      // Fetch prizes for all projects
      if (projectsWithArtifacts.length > 0) {
        const projectIds = projectsWithArtifacts.map((p) => p.id);
        const { data: prizesData } = await supabase
          .from("prizes")
          .select(
            `
            id,
            track_id,
            prize_amount,
            prize_description,
            prize_winners (
              id,
              project_id,
              assigned_at,
              assigned_by,
              projects (
                id,
                project_name,
                lead_name,
                event_id
              )
            )
          `
          )
          .in("prize_winners.project_id", projectIds);

        if (prizesData) {
          const prizesByProject: Record<string, Prize[]> = {};

          // Iterate through each prize and its winners
          prizesData.forEach((prize) => {
            if (prize.prize_winners && prize.prize_winners.length > 0) {
              prize.prize_winners.forEach((winner) => {
                const projectId = winner.project_id;
                if (projectId) {
                  if (!prizesByProject[projectId]) {
                    prizesByProject[projectId] = [];
                  }
                  prizesByProject[projectId].push({
                    id: prize.id,
                    track_id: prize.track_id,
                    prize_amount: prize.prize_amount,
                    prize_description: prize.prize_description,
                    assigned_at: winner.assigned_at,
                    assigned_by: winner.assigned_by,
                  });
                }
              });
            }
          });

          projectsWithArtifacts.forEach((project) => {
            if (!project.id) {
              return;
            }

            (project as unknown as ProjectWithPrizes).prizes_won =
              (prizesByProject[project.id] || []) as Prize[];
          });
        }
      }

      const listRosters = await fetchPublicTeamRosters(
        projectsWithArtifacts.map((project) => project.id)
      );
      return NextResponse.json({
        projects: projectsWithArtifacts.map((project) => ({
          ...project,
          team_members: listRosters.get(project.id)?.members ?? [],
        })),
      });
    }

    // For all other requests, require authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle single project fetch by ID
    if (projectId) {
      const { data: project, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          project_name,
          lead_name,
          project_description,
          project_url,
          video_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          contextus_project_id,
          private,
          created_at,
          submitted,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `
        )
        .eq("id", projectId)
        .single()
        .overrideTypes<{
          project_tracks: Array<{ event_tracks: EventTrack }>;
        }>();

      if (error) {
        console.error("Error fetching project:", error);
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      const [artifactMap, fieldMap, answerMap] = await Promise.all([
        fetchArtifactsByProjectIds(supabase, [project.id]),
        fetchSubmissionFieldsByEventIds(supabase, [project.event_id]),
        fetchSubmissionAnswersByProjectIds(supabase, [project.id]),
      ]);

      // Team emails only for team members, the event's organizers and admins
      // (project_team_emails); everyone else gets the email-free payload.
      const teamEmails = (await getTeamEmails(supabase, [project.id])).get(project.id);

      // Transform project data
      const transformedProject = applyEffectiveSubmissionToProject({
        id: project.id,
        project_name: project.project_name,
        lead_name: project.lead_name,
        ...(teamEmails
          ? { lead_email: teamEmails.lead_email, teammates: teamEmails.teammates }
          : {}),
        is_private: Boolean((project as { private?: boolean | null }).private),
        project_description: project.project_description,
        project_url: project.project_url,
        video_url: (project as unknown as { video_url?: string | null }).video_url,
        additional_materials_url: project.additional_materials_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        contextus_project_id: (
          project as unknown as { contextus_project_id?: string }
        ).contextus_project_id,
        submitted:
          (project as unknown as { submitted?: boolean }).submitted ?? false,
        tracks:
          project.project_tracks
            ?.filter((pt) => Boolean(pt.event_tracks))
            .map((pt) => pt.event_tracks) || [],
        track_ids:
          project.project_tracks
            ?.map((pt) => pt.event_tracks?.track_id)
            .filter(Boolean) || [],
        created_at: project.created_at,
      },
      fieldMap.get(project.event_id) || [],
      answerMap.get(project.id),
      artifactMap.get(project.id) ||
        buildArtifactsFromLegacy({
          project_url: project.project_url,
          additional_materials_url: project.additional_materials_url,
          video_url: (project as unknown as { video_url?: string | null }).video_url,
        })
      );

      // Fetch prizes for this project by starting from prize_winners
      const { data: prizeWinnersData } = await supabase
        .from("prize_winners")
        .select(
          `
            id,
            project_id,
            assigned_at,
            assigned_by,
            prizes (
              id,
              track_id,
              prize_amount,
              prize_description
            )
          `
        )
        .eq("project_id", transformedProject.id)
        .overrideTypes<
          Array<{
            id: string;
            project_id: string;
            assigned_at: string;
            assigned_by: string;
            prizes: {
              id: string;
              track_id: string;
              prize_amount: number;
              prize_description: string;
            };
          }>
        >();

      if (prizeWinnersData) {
        (transformedProject as unknown as ProjectWithPrizes).prizes_won =
          prizeWinnersData as unknown as Prize[];
      }

      const [isFinalist, rosters] = await Promise.all([
        fetchIsFinalist(transformedProject.id),
        fetchPublicTeamRosters([project.id]),
      ]);
      (
        transformedProject as unknown as { is_finalist?: boolean }
      ).is_finalist = isFinalist;

      const roster = rosters.get(project.id);
      const teamMembers = roster
        ? teamEmails
          ? buildProjectTeamMembers(roster.source, roster.profiles, {
              includeEmail: true,
            })
          : roster.members
        : [];

      return NextResponse.json({
        project: { ...transformedProject, team_members: teamMembers },
      });
    }

    // Handle projects by event
    if (eventId) {
      // Check if user is organizer for this event
      const { data: userRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      const isOrganizer =
        userRole &&
        canAccessRole(userRole.role as EventRole, EventRole.Organizer);

      // Build query with track relationships
      const query = supabase
        .from("projects")
        .select(
          `
            ${PROJECT_CLIENT_COLUMNS},
            project_tracks (
              track_id,
              event_tracks (
                track_id,
                name,
                label
              )
            ),
            feedback (
              feedback_text,
              mentor_name,
              mentor_id
            )
          `
        )
        .eq("event_id", eventId);

      // Non-organizers can only see submitted projects
      if (!isOrganizer) {
        query.eq("submitted", true);
      } else if (submitted) {
        // Organizers can optionally filter by submitted
        query.eq("submitted", true);
      }

      const { data: projectsData, error } = await query;

      if (error) {
        console.error("Error fetching projects:", error);
        return NextResponse.json(
          { error: "Failed to fetch projects" },
          { status: 500 }
        );
      }

      // Organizers get every team's emails; members get their own team's;
      // other viewers get none (PUB-008 round 2).
      const listTeamEmails = await getTeamEmails(
        supabase,
        ((projectsData as unknown as OrganizerProjectRow[] | null) || []).map((project) => project.id)
      );
      const transformedProjects: Array<
        OrganizerProjectRow & { track_ids: string[] }
      > = ((projectsData as unknown as OrganizerProjectRow[] | null) || []).map(
        (project) => ({
          ...project,
          ...(listTeamEmails.get(project.id) ?? {}),
          track_ids: project.project_tracks?.map((pt) => pt.track_id) || [],
        })
      );
      const artifactMap = await fetchArtifactsByProjectIds(
        supabase,
        transformedProjects.map((project) => project.id)
      );

      // Collect all unique teammate + lead emails for batch profile enrichment
      const allEmails = new Set<string>();
      for (const project of transformedProjects) {
        const p = project as { lead_email?: string; teammates?: string[] };
        if (p.lead_email) allEmails.add(p.lead_email);
        for (const email of p.teammates ?? []) allEmails.add(email);
      }

      const [fieldMap, answerMap, profileMap] = await Promise.all([
        fetchSubmissionFieldsByEventIds(supabase, [eventId]),
        fetchSubmissionAnswersByProjectIds(
          supabase,
          transformedProjects.map((project) => project.id)
        ),
        fetchTeammateProfiles([...allEmails]),
      ]);

      const transformedProjectsWithArtifacts = transformedProjects.map((project) => {
        const p = project as {
          lead_email?: string;
          teammates?: string[];
        };
        const leadProfile = p.lead_email ? profileMap.get(p.lead_email) : undefined;
        const nonLeadTeammates = (p.teammates ?? []).filter(
          (e) => e !== p.lead_email
        );
        const teammateProfiles = nonLeadTeammates
          .map((email) => profileMap.get(email))
          .filter((profile): profile is ExportMemberProfile => profile !== undefined);

        return applyEffectiveSubmissionToProject(
          {
            ...project,
            is_private: Boolean((project as { private?: boolean | null }).private),
            project_url: project.project_url ?? undefined,
            additional_materials_url:
              project.additional_materials_url ?? undefined,
            video_url: project.video_url ?? undefined,
            lead_school: leadProfile?.affiliation ?? null,
            teammate_profiles: teammateProfiles,
          },
          fieldMap.get(eventId) || [],
          answerMap.get(project.id),
          artifactMap.get(project.id) ||
            buildArtifactsFromLegacy({
              project_url: (project as { project_url?: string | null })
                .project_url,
              additional_materials_url: (
                project as { additional_materials_url?: string | null }
              ).additional_materials_url,
              video_url: (project as { video_url?: string | null }).video_url,
            })
        );
      });

      return NextResponse.json({ projects: transformedProjectsWithArtifacts });
    }

    // If no specific parameters, return error
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, leadName, leadEmail, projectName, contextus } = body as {
      eventId?: string;
      leadName?: string;
      leadEmail?: string;
      projectName?: string;
      contextus?: boolean;
    };

    const insertPayload: Record<string, unknown> = {
      event_id: eventId || null,
      lead_name: leadName || user.user_metadata?.full_name || user.email || "",
      lead_email: leadEmail || user.email,
      project_name: projectName || null,
      submitted: false,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(insertPayload)
      .select("id, lead_name, event_id, project_name")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create draft project" },
        { status: 400 }
      );
    }

    if (contextus) {
      // Immediately create a Contextus project (best-effort)
      let createdContextusId: string | null = null;
      try {
        const label =
          (data.project_name as string | null) ||
          (data.lead_name as string | null) ||
          "Project";
        const contextusPayload = {
          label,
          metadata: {
            mentor_mates_project_id: data.id,
            team_lead_name: data.lead_name,
            team_lead_email: insertPayload.lead_email as string,
            ...(data.event_id ? { event_id: data.event_id } : {}),
          },
        };
        createdContextusId = await createContextusProject(contextusPayload);
        if (createdContextusId) {
          await supabase
            .from("projects")
            .update({ contextus_project_id: createdContextusId })
            .eq("id", data.id);
        }
      } catch (ctxErr) {
        console.error("Contextus create-on-draft failed:", ctxErr);
        // non-blocking
      }
      return NextResponse.json({
        id: data.id,
        contextus_project_id: createdContextusId,
      });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("Error creating draft project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
