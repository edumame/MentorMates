import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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

    const { data: bucket, error } = await supabase
      .from("event_buckets")
      .select(`
        bucket_id,
        bucket_name,
        bucket_description,
        bucket_slug,
        bucket_color,
        bucket_icon,
        visibility,
        created_by,
        created_at,
        updated_at,
        events!inner(
          event_id,
          event_name,
          event_date,
          location,
          visibility,
          cover_image_url
        )
      `)
      .eq("bucket_id", bucketId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Bucket not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ bucket });
  } catch (error) {
    console.error("Error fetching bucket:", error);
    return NextResponse.json(
      { error: "Failed to fetch bucket" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
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
    const { bucket_name, bucket_description, bucket_color, bucket_icon, visibility } = body;

    const { data: bucket, error } = await supabase
      .from("event_buckets")
      .update({
        bucket_name,
        bucket_description,
        bucket_color,
        bucket_icon,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("bucket_id", bucketId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Bucket not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ bucket });
  } catch (error) {
    console.error("Error updating bucket:", error);
    return NextResponse.json(
      { error: "Failed to update bucket" },
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

    // Check if bucket has events
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("event_id")
      .eq("bucket_id", bucketId);

    if (eventsError) throw eventsError;

    if (events && events.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete bucket with events. Move events to another bucket first." },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("event_buckets")
      .delete()
      .eq("bucket_id", bucketId);

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Bucket not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ message: "Bucket deleted successfully" });
  } catch (error) {
    console.error("Error deleting bucket:", error);
    return NextResponse.json(
      { error: "Failed to delete bucket" },
      { status: 500 }
    );
  }
}