import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { EventRole } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const projectId = searchParams.get('projectId');
    const isPublic = searchParams.get('public') === 'true';

    // For public gallery view, no authentication required
    if (isPublic && eventId) {
      // Public view - fetch all projects for the event
      const { data: allProjects, error } = await supabase
        .from("projects")
        .select(`
          id,
          project_name,
          lead_name,
          lead_email,
          project_description,
          teammates,
          project_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          created_at,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `)
        .eq("event_id", eventId)
        .order("project_name");

      if (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      const projects = (allProjects || []).map((item: any) => ({
        id: item.id,
        project_name: item.project_name,
        lead_name: item.lead_name,
        lead_email: item.lead_email,
        project_description: item.project_description,
        teammates: item.teammates,
        project_url: item.project_url,
        additional_materials_url: item.additional_materials_url,
        cover_image_url: item.cover_image_url,
        event_id: item.event_id,
        tracks: item.project_tracks?.map((pt: any) => pt.event_tracks?.[0]).filter(Boolean) || [],
        track_ids: item.project_tracks?.map((pt: any) => pt.event_tracks?.[0]?.track_id).filter(Boolean) || [],
        created_at: item.created_at,
      }));

      // Fetch prizes for all projects
      if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { data: prizesData } = await supabase
          .from("prizes")
          .select(`
            id,
            track_id,
            prize_amount,
            prize_description,
            assigned_at,
            winning_project_id
          `)
          .in("winning_project_id", projectIds);

        if (prizesData) {
          const prizesByProject = prizesData.reduce((acc, prize) => {
            const projectId = prize.winning_project_id!;
            if (!acc[projectId]) acc[projectId] = [];
            acc[projectId].push(prize);
            return acc;
          }, {} as Record<string, typeof prizesData>);

          projects.forEach((project: { id: string; [key: string]: unknown }) => {
            (project as { prizes_won?: unknown[] }).prizes_won = prizesByProject[project.id] || [];
          });
        }
      }

      return NextResponse.json({ projects });
    }

    // For all other requests, require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle single project fetch by ID
    if (projectId) {
      const { data: project, error } = await supabase
        .from("projects")
        .select(`
          id,
          project_name,
          lead_name,
          lead_email,
          project_description,
          teammates,
          project_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          created_at,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `)
        .eq("id", projectId)
        .single();

      if (error) {
        console.error('Error fetching project:', error);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Transform project data
      const transformedProject = {
        id: project.id,
        project_name: project.project_name,
        lead_name: project.lead_name,
        lead_email: project.lead_email,
        project_description: project.project_description,
        teammates: project.teammates,
        project_url: project.project_url,
        additional_materials_url: project.additional_materials_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        tracks: project.project_tracks?.map((pt) => pt.event_tracks?.[0]).filter(Boolean) || [],
        track_ids: project.project_tracks?.map((pt) => pt.event_tracks?.[0]?.track_id).filter(Boolean) || [],
        created_at: project.created_at,
      };

      // Fetch prizes for this project
      const { data: prizesData } = await supabase
        .from("prizes")
        .select(`
          id,
          track_id,
          prize_amount,
          prize_description,
          assigned_at
        `)
        .eq("winning_project_id", projectId);

      if (prizesData) {
        (transformedProject as { prizes_won?: unknown[] }).prizes_won = prizesData;
      }

      return NextResponse.json({ project: transformedProject });
    }

    // Handle projects by event (for organizers)
    if (eventId) {
        // Check if user is organizer for this event
        const { data: userRole } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .single();

        if (!userRole || userRole.role !== EventRole.Organizer) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // Organizer view - fetch all projects with track relationships
        const { data: projectsData, error } = await supabase
          .from("projects")
          .select(`
            *,
            project_tracks (
              track_id
            )
          `)
          .eq("event_id", eventId);

        if (error) {
          console.error('Error fetching projects:', error);
          return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
        }

        const transformedProjects = (projectsData || []).map((project: { project_tracks?: { track_id: string }[]; [key: string]: unknown }) => ({
          ...project,
          track_ids: project.project_tracks?.map((pt: { track_id: string }) => pt.track_id) || [],
        }));

        return NextResponse.json({ projects: transformedProjects });
    }

    // If no specific parameters, return error
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}