import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

// File magic numbers (first bytes) for validation
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a or GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP container)
  'image/svg+xml': [[0x3C, 0x73, 0x76, 0x67], [0x3C, 0x3F, 0x78, 0x6D, 0x6C]], // <svg or <?xml
};

function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) {
    // For MIME types without signatures (like SVG text-based), allow if MIME matches
    return ALLOWED_MIME_TYPES.includes(mimeType);
  }

  // Check if buffer matches any of the valid signatures for this MIME type
  return signatures.some(signature => {
    if (buffer.length < signature.length) return false;
    return signature.every((byte, index) => buffer[index] === byte);
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const eventId = formData.get('eventId') as string;

    if (!file) {
      console.error('No file provided in request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!eventId) {
      console.error('No event ID provided in request');
      return NextResponse.json({ error: 'No event ID provided' }, { status: 400 });
    }

    console.log('Upload request:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      eventId,
      userId: user.id,
    });

    // Check if user is organizer/admin for this event
    const { data: roleData, error: roleError } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single();

    if (roleError) {
      console.error('Error checking user role:', roleError);
    }

    if (!roleData || !['organizer', 'admin'].includes(roleData.role)) {
      console.warn('User authorization failed:', {
        userId: user.id,
        eventId,
        role: roleData?.role,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('User authorized:', {
      userId: user.id,
      role: roleData.role,
      eventId,
    });

    // Server-side MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // File size validation (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file signature (magic numbers) to prevent MIME type spoofing
    if (!validateFileSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared MIME type. Possible file spoofing detected.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${eventId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage with validated content type
    console.log('Attempting upload to storage:', {
      bucket: 'lesson-images',
      fileName,
      fileSize: buffer.length,
      contentType: file.type,
    });

    const { data, error } = await supabase.storage
      .from('lesson-images')
      .upload(fileName, buffer, {
        contentType: file.type, // Already validated above
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage upload error:', {
        error,
        errorMessage: error.message,
        errorDetails: JSON.stringify(error),
        fileName,
        bucket: 'lesson-images',
      });
      return NextResponse.json({
        error: 'Failed to upload image',
        details: error.message
      }, { status: 500 });
    }

    console.log('Upload successful:', {
      path: data.path,
      fileName,
    });

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-images')
      .getPublicUrl(data.path);

    console.log('Generated public URL:', publicUrl);

    return NextResponse.json({ url: publicUrl }, { status: 200 });
  } catch (error) {
    console.error('Error in upload-lesson-image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
