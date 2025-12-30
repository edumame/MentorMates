import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { parseLumaCSV, detectInvitationSource, getImportableRows } from '@/features/invitations/utils/luma-csv-adapter';
import { InvitationStatus } from '@/features/invitations/types';
import type { ParsedInvitation, ImportResponse } from '@/features/invitations/types';

/**
 * POST /api/events/[eventId]/invitations/import
 * 
 * Parse and import invitations from a CSV file (Luma or generic format)
 * 
 * Request body (multipart/form-data):
 * - file: CSV file
 * - preview: boolean (optional) - if true, only parse and validate without importing
 * 
 * Or JSON body:
 * - csvContent: string - raw CSV content
 * - preview: boolean (optional)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId } = await context.params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is organizer or admin for this event
    const { data: userRole } = await supabase
      .from('user_event_roles')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc('is_admin_user', { user_id: user.id });

    const isOrganizer = userRole?.role === 'organizer' || userRole?.role === 'admin';
    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('event_id, event_name')
      .eq('event_id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Parse request body
    let csvContent: string;
    let previewOnly = false;

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      previewOnly = formData.get('preview') === 'true';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      csvContent = await file.text();
    } else {
      const body = await request.json();
      csvContent = body.csvContent;
      previewOnly = body.preview === true;

      if (!csvContent) {
        return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 });
      }
    }

    // Get existing invitations for this event to check duplicates
    const { data: existingInvitations } = await supabase
      .from('event_invitations')
      .select('email')
      .eq('event_id', eventId);

    const existingEmails = new Set(
      existingInvitations?.map(inv => inv.email.toLowerCase()) || []
    );

    // Parse the CSV
    const parseResult = parseLumaCSV(csvContent, existingEmails);

    // If preview mode, return parse results without importing
    if (previewOnly) {
      return NextResponse.json({
        success: parseResult.success,
        preview: true,
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        invalidRows: parseResult.invalidRows,
        duplicateRows: parseResult.duplicateRows,
        errors: parseResult.errors,
        detectedColumns: parseResult.detectedColumns,
        rows: parseResult.rows,
      });
    }

    // Get only importable rows (valid, non-duplicate, non-existing)
    const importableRows = getImportableRows(parseResult, false);

    if (importableRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid rows to import',
        parseResult: {
          totalRows: parseResult.totalRows,
          validRows: parseResult.validRows,
          invalidRows: parseResult.invalidRows,
          duplicateRows: parseResult.duplicateRows,
        },
      }, { status: 400 });
    }

    // Detect source type
    const source = detectInvitationSource(parseResult.detectedColumns);

    // Prepare invitations for insertion
    const invitationsToInsert = importableRows.map(row => ({
      event_id: eventId,
      email: row.data.email,
      name: row.data.name,
      first_name: row.data.first_name,
      last_name: row.data.last_name,
      phone_number: row.data.phone_number,
      status: InvitationStatus.PENDING,
      source: source,
      source_metadata: row.data.source_metadata,
      luma_status: row.data.luma_status,
      invited_by: user.id,
    }));

    // Insert invitations in batches of 100
    const batchSize = 100;
    const importedCount: number[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < invitationsToInsert.length; i += batchSize) {
      const batch = invitationsToInsert.slice(i, i + batchSize);
      
      const { data: inserted, error: insertError } = await supabase
        .from('event_invitations')
        .insert(batch)
        .select('id');

      if (insertError) {
        // Try individual inserts to identify specific failures
        for (const invitation of batch) {
          const { error: singleError } = await supabase
            .from('event_invitations')
            .insert(invitation);

          if (singleError) {
            errors.push({
              email: invitation.email,
              error: singleError.message || 'Failed to insert',
            });
          } else {
            importedCount.push(1);
          }
        }
      } else {
        importedCount.push(inserted?.length || batch.length);
      }
    }

    const totalImported = importedCount.reduce((sum, count) => sum + count, 0);

    const response: ImportResponse = {
      success: totalImported > 0,
      imported: totalImported,
      skipped: parseResult.totalRows - totalImported - errors.length,
      errors,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error importing invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

