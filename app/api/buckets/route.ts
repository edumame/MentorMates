import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { BucketPermission } from "@/lib/types";

export async function GET() {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Return only public buckets for unauthenticated users
      const { data: publicBuckets, error } = await supabase
        .from("event_buckets")
        .select(`
          bucket_id,
          bucket_name,
          bucket_description,
          bucket_slug,
          bucket_color,
          bucket_icon,
          visibility,
          created_at,
          updated_at,
          events!inner(count)
        `)
        .eq("visibility", "public");

      if (error) throw error;

      const bucketsWithCount = publicBuckets.map(bucket => ({
        ...bucket,
        event_count: bucket.events?.length || 0,
        events: undefined // Remove the events array, keep only count
      }));

      return NextResponse.json({ buckets: bucketsWithCount });
    }

    // For authenticated users, get buckets they have access to
    const { data: buckets, error } = await supabase
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
        events!inner(count)
      `);

    if (error) throw error;

    const bucketsWithCount = buckets.map(bucket => ({
      ...bucket,
      event_count: bucket.events?.length || 0,
      events: undefined // Remove the events array, keep only count
    }));

    return NextResponse.json({ buckets: bucketsWithCount });
  } catch (error) {
    console.error("Error fetching buckets:", error);
    return NextResponse.json(
      { error: "Failed to fetch buckets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

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
    const { bucket_name, bucket_description, bucket_slug, bucket_color, bucket_icon, visibility } = body;

    if (!bucket_name || !bucket_slug) {
      return NextResponse.json(
        { error: "Bucket name and slug are required" },
        { status: 400 }
      );
    }

    const { data: bucket, error } = await supabase
      .from("event_buckets")
      .insert({
        bucket_name,
        bucket_description,
        bucket_slug,
        bucket_color: bucket_color || "#3B82F6",
        bucket_icon,
        visibility: visibility || "private",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") { // Unique constraint violation
        return NextResponse.json(
          { error: "Bucket slug already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ bucket }, { status: 201 });
  } catch (error) {
    console.error("Error creating bucket:", error);
    return NextResponse.json(
      { error: "Failed to create bucket" },
      { status: 500 }
    );
  }
}