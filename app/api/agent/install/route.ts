import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { generateApiKey } from "@/lib/agent/crypto";

// POST: Auto-generate an API key and return the install command
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

    const { event_id } = await request.json();
    if (!event_id) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      );
    }

    // Verify user is organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !Boolean(isAdminRpc)) {
      return NextResponse.json(
        { error: "Only organizers can install the skill" },
        { status: 403 }
      );
    }

    // Get event name for the skill label
    const { data: event } = await supabase
      .from("events")
      .select("event_name")
      .eq("event_id", event_id)
      .single();

    // Generate the key
    const { raw, hash, prefix } = generateApiKey();

    const { error: insertError } = await supabase
      .from("agent_api_keys")
      .insert({
        user_id: user.id,
        key_hash: hash,
        key_prefix: prefix,
        label: `auto-install-${new Date().toISOString().slice(0, 10)}`,
      });

    if (insertError) {
      console.error("Error creating API key:", insertError);
      return NextResponse.json(
        { error: "Failed to generate API key" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mentormates.ai";
    const eventName = event?.event_name || "MentorMates Event";

    // Build the skill content with the key baked in
    const skillContent = buildSkillContent(baseUrl, raw, eventName, event_id);

    return NextResponse.json({
      success: true,
      api_key: raw,
      event_name: eventName,
      skill_content: skillContent,
      setup_commands: {
        env_export: `export MENTORMATES_API_KEY="${raw}"`,
        event_export: `export MENTORMATES_EVENT_ID="${event_id}"`,
        skill_save: `mkdir -p .claude && curl -s "${baseUrl}/api/agent/skill" > .claude/commands/mentormates.md`,
      },
    });
  } catch (error) {
    console.error("Error in agent install:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildSkillContent(baseUrl: string, apiKey: string, eventName: string, eventId: string): string {
  return `---
name: mentormates
description: Manage "${eventName}" on MentorMates
---

You are a MentorMates event management assistant for "${eventName}".

## Authentication
API Key: ${apiKey}
Base URL: ${baseUrl}/api/agent
Event ID: ${eventId}

All requests use: Authorization: Bearer ${apiKey}
All event routes require: ?event_id=${eventId}

## Commands

### Event Overview
\`\`\`bash
curl -s -H "Authorization: Bearer ${apiKey}" "${baseUrl}/api/agent/events?event_id=${eventId}" | jq
\`\`\`

### List Participants
\`\`\`bash
curl -s -H "Authorization: Bearer ${apiKey}" "${baseUrl}/api/agent/events/participants?event_id=${eventId}&role=participant" | jq
\`\`\`

### View Pending Approval Requests
\`\`\`bash
curl -s -H "Authorization: Bearer ${apiKey}" "${baseUrl}/api/agent/events/approval-requests?event_id=${eventId}&status=pending" | jq
\`\`\`

### Approve a Request
\`\`\`bash
curl -s -X POST -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" \\
  -d '{"request_id":"UUID","action":"approve"}' \\
  "${baseUrl}/api/agent/events/approval-requests?event_id=${eventId}" | jq
\`\`\`

### Reject a Request
\`\`\`bash
curl -s -X POST -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" \\
  -d '{"request_id":"UUID","action":"reject","rejection_reason":"..."}' \\
  "${baseUrl}/api/agent/events/approval-requests?event_id=${eventId}" | jq
\`\`\`

### Manage Participants (change role or remove)
\`\`\`bash
curl -s -X PATCH -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" \\
  -d '{"user_id":"UUID","action":"change_role","role":"judge"}' \\
  "${baseUrl}/api/agent/events/participants?event_id=${eventId}" | jq
\`\`\`

### View Projects
\`\`\`bash
curl -s -H "Authorization: Bearer ${apiKey}" "${baseUrl}/api/agent/events/projects?event_id=${eventId}&submitted=true" | jq
\`\`\`

### View Judges + Scoring Progress
\`\`\`bash
curl -s -H "Authorization: Bearer ${apiKey}" "${baseUrl}/api/agent/events/judges?event_id=${eventId}" | jq
\`\`\`

### Send Info to Judges
\`\`\`bash
curl -s -X POST -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" \\
  -d '{"message":"...","subject":"Reminder"}' \\
  "${baseUrl}/api/agent/events/judges?event_id=${eventId}" | jq
\`\`\`

### Update Event Details
\`\`\`bash
curl -s -X PATCH -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" \\
  -d '{"event_name":"...","event_description":"..."}' \\
  "${baseUrl}/api/agent/events?event_id=${eventId}" | jq
\`\`\`

## Behavior
1. Always start by fetching the event overview.
2. Summarize data in readable table format.
3. Confirm with the user before batch operations.
4. Preview emails before sending.
`;
}
