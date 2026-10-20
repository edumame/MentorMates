import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { BucketPermission } from "@/lib/types";

interface RouteParams {
  params: Promise<{ bucketId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseClient();
  const { bucketId } = await params;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: permissions, error } = await supabase
      .from("bucket_permissions")
      .select(`
        id,
        bucket_id,
        user_id,
        permission,
        granted_by,
        granted_at,
        user_profiles!bucket_permissions_user_id_fkey(
          uid,
          display_name
        )
      `)
      .eq("bucket_id", bucketId);

    if (error) throw error;

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Error fetching bucket permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch bucket permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseClient();
  const { bucketId } = await params;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_id, permission } = body;

    if (!user_id || !permission) {
      return NextResponse.json(
        { error: "User ID and permission are required" },
        { status: 400 }
      );
    }

    if (!Object.values(BucketPermission).includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission type" },
        { status: 400 }
      );
    }

    // Check if user has permission to grant access
    const { data: hasAccess, error: accessError } = await supabase
      .rpc("check_bucket_access", {
        bucket_id_param: bucketId,
        user_id_param: user.id,
        required_permission: "admin"
      });

    if (accessError) throw accessError;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions to grant access" },
        { status: 403 }
      );
    }

    const { data: permissionRecord, error } = await supabase
      .from("bucket_permissions")
      .upsert({
        bucket_id: bucketId,
        user_id,
        permission,
        granted_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ permission: permissionRecord }, { status: 201 });
  } catch (error) {
    console.error("Error granting bucket permission:", error);
    return NextResponse.json(
      { error: "Failed to grant bucket permission" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseClient();
  const { bucketId } = await params;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("user_id");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user has permission to revoke access
    const { data: hasAccess, error: accessError } = await supabase
      .rpc("check_bucket_access", {
        bucket_id_param: bucketId,
        user_id_param: user.id,
        required_permission: "admin"
      });

    if (accessError) throw accessError;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions to revoke access" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("bucket_permissions")
      .delete()
      .eq("bucket_id", bucketId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    return NextResponse.json({ message: "Permission revoked successfully" });
  } catch (error) {
    console.error("Error revoking bucket permission:", error);
    return NextResponse.json(
      { error: "Failed to revoke bucket permission" },
      { status: 500 }
    );
  }
}