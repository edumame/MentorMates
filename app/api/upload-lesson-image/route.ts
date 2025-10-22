import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const eventId = formData.get('eventId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: 'No event ID provided' }, { status: 400 });
    }

    // Check if user is organizer/admin for this event
    const { data: roleData } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single();

    if (!roleData || !['organizer', 'admin'].includes(roleData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${eventId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('lesson-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading to storage:', error);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-images')
      .getPublicUrl(data.path);

    return NextResponse.json({ url: publicUrl }, { status: 200 });
  } catch (error) {
    console.error('Error in upload-lesson-image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
