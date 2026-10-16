import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import {
  TeamMemberRole,
  TeamMemberWithProfile,
  TeamWithMembers,
} from "@/lib/types/team";

const createSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(120),
  memberUserIds: z.array(z.string().uuid()).optional(),
});

const patchSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  addUserIds: z.array(z.string().uuid()).optional(),
  removeUserIds: z.array(z.string().uuid()).optional(),
  projectId: z.string().uuid().nullable().optional(),
});

async function getUserAndRole(eventId: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, user: null, role: null };

  const { data: roleRow } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: (roleRow?.role as EventRole | undefined) ?? null,
  };
}

function isModeratorRole(role: EventRole | null): boolean {
  return role === EventRole.Organizer || role === EventRole.Admin;
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

// Builds TeamWithMembers[] for the given team rows, enriching members with profiles.
async function hydrateTeams(
  service: ServiceClient,
  teamRows: Array<{
    id: string;
    event_id: string;
    name: string;
    created_by: string | null;
    project_id: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>
): Promise<TeamWithMembers[]> {
  if (teamRows.length === 0) return [];

  const teamIds = teamRows.map((t) => t.id);
  const { data: memberRows, error: membersErr } = await service
    .from("team_members")
    .select("id, team_id, user_id, event_id, role, joined_at")
    .in("team_id", teamIds);

  if (membersErr) throw membersErr;

  const userIds = Array.from(
    new Set((memberRows ?? []).map((m) => m.user_id))
  );

  const profileMap = new Map<
    string,
    { display_name: string | null; email: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await service
      .from("user_profiles")
      .select("uid, display_name, email, avatar_url")
      .in("uid", userIds);
    if (profErr) throw profErr;
    (profiles ?? []).forEach((p) =>
      p.uid && profileMap.set(p.uid, {
        display_name: p.display_name,
        email: p.email,
        avatar_url: p.avatar_url,
      })
    );
  }

  return teamRows.map((team) => {
    const members: TeamMemberWithProfile[] = (memberRows ?? [])
      .filter((m) => m.team_id === team.id)
      .map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          id: m.id,
          team_id: m.team_id,
          user_id: m.user_id,
          event_id: m.event_id,
          role: m.role as TeamMemberRole,
          joined_at: m.joined_at ?? "",
          display_name: profile?.display_name ?? null,
          email: profile?.email ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      })
      // Leads first, then by join time.
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === TeamMemberRole.Lead ? -1 : 1;
        return a.joined_at.localeCompare(b.joined_at);
      });

    return {
      id: team.id,
      event_id: team.event_id,
      name: team.name,
      created_by: team.created_by,
      project_id: team.project_id,
      created_at: team.created_at ?? "",
      updated_at: team.updated_at ?? "",
      members,
    };
  });
}

// Returns the userIds (from the candidate list) that already belong to a team in this event.
async function findUsersAlreadyOnTeam(
  service: ServiceClient,
  eventId: string,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await service
    .from("team_members")
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", userIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id));
}

// Returns the userIds (from the candidate list) that hold a role on the event.
async function filterEventMembers(
  service: ServiceClient,
  eventId: string,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await service
    .from("user_event_roles")
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", userIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id));
}

// GET — caller's own team; organizers/admins also receive all teams in the event.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = createSupabaseServiceClient();

    // Find the caller's membership (one team per event).
    const { data: myMembership, error: myErr } = await service
      .from("team_members")
      .select("team_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (myErr) {
      console.error("team_members fetch error", myErr);
      return NextResponse.json(
        { error: "Failed to load team" },
        { status: 500 }
      );
    }

    const teamSelect =
      "id, event_id, name, created_by, project_id, created_at, updated_at";

    let myTeam: TeamWithMembers | null = null;
    if (myMembership?.team_id) {
      const { data: teamRow, error: teamErr } = await service
        .from("teams")
        .select(teamSelect)
        .eq("id", myMembership.team_id)
        .maybeSingle();
      if (teamErr) {
        console.error("team fetch error", teamErr);
        return NextResponse.json(
          { error: "Failed to load team" },
          { status: 500 }
        );
      }
      if (teamRow) {
        myTeam = (await hydrateTeams(service, [teamRow]))[0] ?? null;
      }
    }

    let teams: TeamWithMembers[] = [];
    if (isModeratorRole(role)) {
      const { data: allTeams, error: allErr } = await service
        .from("teams")
        .select(teamSelect)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (allErr) {
        console.error("teams fetch error", allErr);
        return NextResponse.json(
          { error: "Failed to load teams" },
          { status: 500 }
        );
      }
      teams = await hydrateTeams(service, allTeams ?? []);
    }

    return NextResponse.json({ myTeam, teams });
  } catch (error) {
    console.error("teams GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — create a team. Caller becomes lead; optional initial members.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role) {
      return NextResponse.json(
        { error: "You must be a member of this event to create a team" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name } = parsed.data;
    const isModerator = isModeratorRole(role);

    const service = createSupabaseServiceClient();

    // A participant creating a team joins it as lead. A moderator (organizer/admin)
    // creates on others' behalf and is NOT added as a member; the first selected
    // participant becomes the lead so they can manage the team.
    if (!isModerator) {
      const onTeam = await findUsersAlreadyOnTeam(service, eventId, [user.id]);
      if (onTeam.has(user.id)) {
        return NextResponse.json(
          { error: "You are already on a team for this event" },
          { status: 409 }
        );
      }
    }

    // Validate requested members: must be event members, not already on a team.
    // For a participant, exclude themselves (they're added separately as lead).
    const requestedMembers = Array.from(
      new Set(
        (parsed.data.memberUserIds ?? []).filter(
          (id) => isModerator || id !== user.id
        )
      )
    );
    if (requestedMembers.length > 0) {
      const eventMembers = await filterEventMembers(
        service,
        eventId,
        requestedMembers
      );
      const notMembers = requestedMembers.filter((id) => !eventMembers.has(id));
      if (notMembers.length > 0) {
        return NextResponse.json(
          { error: "Some selected users are not part of this event" },
          { status: 400 }
        );
      }
      const alreadyOnTeam = await findUsersAlreadyOnTeam(
        service,
        eventId,
        requestedMembers
      );
      if (alreadyOnTeam.size > 0) {
        return NextResponse.json(
          {
            error:
              "Some selected users are already on a team for this event",
          },
          { status: 409 }
        );
      }
    }

    // Determine the lead and membership rows.
    const leadId = isModerator ? requestedMembers[0] ?? null : user.id;

    const memberInserts = isModerator
      ? requestedMembers.map((uid, i) => ({
          team_id: "", // filled in after team insert
          user_id: uid,
          event_id: eventId,
          role: i === 0 ? TeamMemberRole.Lead : TeamMemberRole.Member,
        }))
      : [
          {
            team_id: "",
            user_id: user.id,
            event_id: eventId,
            role: TeamMemberRole.Lead,
          },
          ...requestedMembers.map((uid) => ({
            team_id: "",
            user_id: uid,
            event_id: eventId,
            role: TeamMemberRole.Member,
          })),
        ];

    // Create the team.
    const { data: team, error: teamErr } = await service
      .from("teams")
      .insert({ event_id: eventId, name, created_by: leadId })
      .select("id, event_id, name, created_by, project_id, created_at, updated_at")
      .single();
    if (teamErr || !team) {
      console.error("team insert error", teamErr);
      return NextResponse.json(
        { error: "Failed to create team" },
        { status: 500 }
      );
    }

    memberInserts.forEach((row) => {
      row.team_id = team.id;
    });

    if (memberInserts.length > 0) {
      const { error: memberErr } = await service
        .from("team_members")
        .insert(memberInserts);
      if (memberErr) {
        // Roll back the team on failure (unique violation race or otherwise).
        await service.from("teams").delete().eq("id", team.id);
        if ((memberErr as { code?: string }).code === "23505") {
          return NextResponse.json(
            { error: "You or a selected member is already on a team" },
            { status: 409 }
          );
        }
        console.error("team_members insert error", memberErr);
        return NextResponse.json(
          { error: "Failed to create team" },
          { status: 500 }
        );
      }
    }

    const hydrated = (await hydrateTeams(service, [team]))[0] ?? null;
    return NextResponse.json({ team: hydrated }, { status: 201 });
  } catch (error) {
    console.error("teams POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH — rename, add/remove members, set/clear project link. Lead or organizer/admin.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { teamId, name, addUserIds, removeUserIds, projectId } = parsed.data;

    const service = createSupabaseServiceClient();

    const { data: team, error: teamErr } = await service
      .from("teams")
      .select("id, event_id, created_by")
      .eq("id", teamId)
      .maybeSingle();
    if (teamErr || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    const canManage =
      isModeratorRole(role) || team.created_by === user.id;
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update scalar fields.
    const teamUpdate: { name?: string; project_id?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) teamUpdate.name = name;
    if (projectId !== undefined) teamUpdate.project_id = projectId;
    if (name !== undefined || projectId !== undefined) {
      const { error: updErr } = await service
        .from("teams")
        .update(teamUpdate)
        .eq("id", teamId);
      if (updErr) {
        console.error("team update error", updErr);
        return NextResponse.json(
          { error: "Failed to update team" },
          { status: 500 }
        );
      }
    }

    // Remove members (never remove the lead via this path).
    const toRemove = (removeUserIds ?? []).filter(
      (id) => id !== team.created_by
    );
    if (toRemove.length > 0) {
      const { error: rmErr } = await service
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .in("user_id", toRemove);
      if (rmErr) {
        console.error("member remove error", rmErr);
        return NextResponse.json(
          { error: "Failed to remove members" },
          { status: 500 }
        );
      }
    }

    // Add members: must be event members and not already on a team.
    const toAdd = Array.from(new Set(addUserIds ?? []));
    if (toAdd.length > 0) {
      const eventMembers = await filterEventMembers(service, eventId, toAdd);
      const notMembers = toAdd.filter((id) => !eventMembers.has(id));
      if (notMembers.length > 0) {
        return NextResponse.json(
          { error: "Some selected users are not part of this event" },
          { status: 400 }
        );
      }
      const alreadyOnTeam = await findUsersAlreadyOnTeam(service, eventId, toAdd);
      if (alreadyOnTeam.size > 0) {
        return NextResponse.json(
          { error: "Some selected users are already on a team" },
          { status: 409 }
        );
      }
      const { error: addErr } = await service.from("team_members").insert(
        toAdd.map((uid) => ({
          team_id: teamId,
          user_id: uid,
          event_id: eventId,
          role: TeamMemberRole.Member,
        }))
      );
      if (addErr) {
        if ((addErr as { code?: string }).code === "23505") {
          return NextResponse.json(
            { error: "Some selected users are already on a team" },
            { status: 409 }
          );
        }
        console.error("member add error", addErr);
        return NextResponse.json(
          { error: "Failed to add members" },
          { status: 500 }
        );
      }
    }

    const { data: refreshed } = await service
      .from("teams")
      .select("id, event_id, name, created_by, project_id, created_at, updated_at")
      .eq("id", teamId)
      .single();
    const hydrated = refreshed
      ? (await hydrateTeams(service, [refreshed]))[0] ?? null
      : null;
    return NextResponse.json({ team: hydrated });
  } catch (error) {
    console.error("teams PATCH error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — dissolve a team (?teamId=) or remove/leave a single member (?teamId=&userId=).
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teamId = request.nextUrl.searchParams.get("teamId");
    const userId = request.nextUrl.searchParams.get("userId");
    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }

    const service = createSupabaseServiceClient();

    const { data: team, error: teamErr } = await service
      .from("teams")
      .select("id, event_id, created_by")
      .eq("id", teamId)
      .maybeSingle();
    if (teamErr || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    const isLead = team.created_by === user.id;
    const isModerator = isModeratorRole(role);

    // Remove a single member (or leave).
    if (userId) {
      const isSelf = userId === user.id;
      if (!isSelf && !isLead && !isModerator) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Removing the lead is equivalent to dissolving the team.
      if (userId === team.created_by) {
        if (!isLead && !isModerator) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const { error: delErr } = await service
          .from("teams")
          .delete()
          .eq("id", teamId);
        if (delErr) {
          console.error("team dissolve error", delErr);
          return NextResponse.json(
            { error: "Failed to dissolve team" },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, dissolved: true });
      }

      const { error: rmErr } = await service
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", userId);
      if (rmErr) {
        console.error("member remove error", rmErr);
        return NextResponse.json(
          { error: "Failed to remove member" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // Dissolve the whole team.
    if (!isLead && !isModerator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error: delErr } = await service
      .from("teams")
      .delete()
      .eq("id", teamId);
    if (delErr) {
      console.error("team dissolve error", delErr);
      return NextResponse.json(
        { error: "Failed to dissolve team" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, dissolved: true });
  } catch (error) {
    console.error("teams DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
