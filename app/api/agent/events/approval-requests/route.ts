import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

// GET: List pending/all approval requests
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:read");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const supabase = createSupabaseServiceClient();
    const statusParse = z
      .enum(["pending", "approved", "rejected", "withdrawn"])
      .safeParse(request.nextUrl.searchParams.get("status") || "pending");
    if (!statusParse.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const status = statusParse.data;
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50"),
      200
    );
    const offset = parseInt(
      request.nextUrl.searchParams.get("offset") || "0"
    );

    const { data: requests, error, count } = await supabase
      .from("participant_approval_requests")
      .select(
        `
        *,
        user_profile:user_profiles!participant_approval_requests_user_id_fkey(
          uid, display_name, email, avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("event_id", auth.eventId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching approval requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch requests" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests, total: count, limit, offset });
  } catch (error) {
    console.error("Agent approval-requests GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const reviewRequestSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  rejection_reason: z.string().max(1000).optional(),
});

// POST: Approve or reject an approval request
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const body = await request.json();
    const parsed = reviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { request_id, action, rejection_reason } = parsed.data;
    const supabase = createSupabaseServiceClient();

    // Fetch the request
    const { data: approvalReq, error: fetchError } = await supabase
      .from("participant_approval_requests")
      .select("*")
      .eq("id", request_id)
      .eq("event_id", auth.eventId)
      .single();

    if (fetchError || !approvalReq) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }

    if (approvalReq.status !== "pending") {
      return NextResponse.json(
        { error: `Request is already ${approvalReq.status}` },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update the request
    const { error: updateError } = await supabase
      .from("participant_approval_requests")
      .update({
        status: newStatus,
        rejection_reason:
          action === "reject" ? rejection_reason || null : null,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update request" },
        { status: 500 }
      );
    }

    // If approved, create user_event_role (for non-paid events)
    if (action === "approve") {
      const { data: event } = await supabase
        .from("events")
        .select("paid")
        .eq("event_id", auth.eventId)
        .single();

      if (!event?.paid) {
        const { data: existingRole } = await supabase
          .from("user_event_roles")
          .select("*")
          .eq("event_id", auth.eventId)
          .eq("user_id", approvalReq.user_id)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleError } = await supabase
            .from("user_event_roles")
            .insert({
              event_id: auth.eventId,
              user_id: approvalReq.user_id,
              role: approvalReq.requested_role,
            });

          if (roleError) {
            // Revert
            await supabase
              .from("participant_approval_requests")
              .update({
                status: "pending",
                reviewed_by: null,
                reviewed_at: null,
              })
              .eq("id", request_id);

            return NextResponse.json(
              { error: "Failed to assign role" },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message:
        action === "approve"
          ? "Request approved. User added to event."
          : "Request rejected.",
    });
  } catch (error) {
    console.error("Agent approval-requests POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
