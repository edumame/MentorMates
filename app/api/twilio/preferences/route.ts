import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';

// Notification preferences interface
interface NotificationPreferences {
  email_enabled?: boolean;
  sms_enabled?: boolean;
  voice_enabled?: boolean;
  whatsapp_enabled?: boolean;
  project_submission_email?: boolean;
  project_submission_sms?: boolean;
  feedback_email?: boolean;
  feedback_sms?: boolean;
  event_reminders_email?: boolean;
  event_reminders_sms?: boolean;
  team_invitations_email?: boolean;
  team_invitations_sms?: boolean;
}

// GET user notification preferences
export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // If no preferences found, create default ones
    if (!preferences) {
      const defaultPreferences = {
        user_id: user.id,
        email_enabled: true,
        sms_enabled: false,
        voice_enabled: false,
        whatsapp_enabled: false,
        project_submission_email: true,
        project_submission_sms: false,
        feedback_email: true,
        feedback_sms: false,
        event_reminders_email: true,
        event_reminders_sms: false,
        team_invitations_email: true,
        team_invitations_sms: false,
      };

      const { data: newPreferences, error: insertError } = await supabase
        .from('notification_preferences')
        .insert(defaultPreferences)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating default preferences:', insertError);
        return NextResponse.json(
          { error: 'Failed to create default preferences' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        preferences: newPreferences,
      });
    }

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error) {
    console.error('Error in preferences GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT/UPDATE user notification preferences
export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const updates: NotificationPreferences = await request.json();

    // Validate the updates object
    const allowedFields = [
      'email_enabled',
      'sms_enabled', 
      'voice_enabled',
      'whatsapp_enabled',
      'project_submission_email',
      'project_submission_sms',
      'feedback_email',
      'feedback_sms',
      'event_reminders_email',
      'event_reminders_sms',
      'team_invitations_email',
      'team_invitations_sms',
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key as keyof NotificationPreferences];
        return obj;
      }, {} as any);

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update preferences using upsert
    const { data: updatedPreferences, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...filteredUpdates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    // If SMS was enabled, check if user has a verified phone number
    if (filteredUpdates.sms_enabled) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone_number, phone_verified')
        .eq('id', user.id)
        .single();

      if (!profile?.phone_number || !profile?.phone_verified) {
        return NextResponse.json({
          success: true,
          preferences: updatedPreferences,
          warning: 'SMS enabled but phone number not verified. Please verify your phone number to receive SMS notifications.',
        });
      }
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    });

  } catch (error) {
    console.error('Error in preferences PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST to enable/disable specific notification type quickly
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action, type } = await request.json();

    if (!action || !type) {
      return NextResponse.json(
        { error: 'Missing action or type' },
        { status: 400 }
      );
    }

    const validActions = ['enable', 'disable'];
    const validTypes = ['sms', 'voice', 'whatsapp', 'email'];

    if (!validActions.includes(action) || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid action or type' },
        { status: 400 }
      );
    }

    const enabled = action === 'enable';
    const fieldName = `${type}_enabled`;

    // Update the specific preference
    const { data: updatedPreferences, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          [fieldName]: enabled,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preference:', error);
      return NextResponse.json(
        { error: 'Failed to update preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type.toUpperCase()} notifications ${enabled ? 'enabled' : 'disabled'}`,
      preferences: updatedPreferences,
    });

  } catch (error) {
    console.error('Error in preferences POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}