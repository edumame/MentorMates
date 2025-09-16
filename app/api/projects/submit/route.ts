import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createContextusProject } from "@/lib/integrations/contextus";

export async function POST(request: Request) {
	const supabase = await createSupabaseClient();

	try {
		const { data: user, error: userError } = await supabase.auth.getUser();
		if (!user?.user || userError) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			projectId,
			projectName,
			leadName,
			leadEmail,
			projectDescription,
			teammates,
			projectUrl,
			coverImageUrl,
			additionalMaterialsUrl,
			eventId,
			trackIds,
			videoUrl,
		} = body as {
			projectId?: string;
			projectName?: string;
			leadName?: string;
			leadEmail?: string;
			projectDescription?: string;
			teammates?: string[];
			projectUrl?: string;
			coverImageUrl?: string;
			additionalMaterialsUrl?: string;
			eventId?: string;
			trackIds?: string[];
			videoUrl?: string;
		};

		// If eventId provided, validate event and submission window; otherwise skip
		let eventData: { submission_time_start: string; submission_time_cutoff: string } | null = null;
		if (eventId) {
			const { data, error: eventError } = await supabase
				.from("events")
				.select("event_id, submission_time_start, submission_time_cutoff")
				.eq("event_id", eventId)
				.single();

			if (eventError) {
				return NextResponse.json(
					{ error: "Failed to fetch event data" },
					{ status: 500 }
				);
			}

			if (!data) {
				return NextResponse.json({ error: "Event not found" }, { status: 404 });
			}

			eventData = data as unknown as { submission_time_start: string; submission_time_cutoff: string };

			const now = new Date();
			const submissionStart = new Date(eventData.submission_time_start);
			const submissionCutoff = new Date(eventData.submission_time_cutoff);
			if (now < submissionStart) {
				return NextResponse.json(
					{ error: "Project submission has not started yet" },
					{ status: 400 }
				);
			}
			if (now > submissionCutoff) {
				return NextResponse.json(
					{ error: "Project submission deadline has passed" },
					{ status: 400 }
				);
			}
		}

		// Validate track ids only when event context exists
		let validTrackIds: string[] = [];
		if (eventId && trackIds && trackIds.length > 0) {
			const { data: validTracks, error: trackError } = await supabase
				.from("event_tracks")
				.select("track_id")
				.eq("event_id", eventId)
				.in("track_id", trackIds);
			if (trackError) {
				return NextResponse.json(
					{ error: "Failed to validate tracks" },
					{ status: 500 }
				);
			}
			validTrackIds = (validTracks || []).map((t: { track_id: string }) => t.track_id);
			const invalidTracks = trackIds.filter((id: string) => !validTrackIds.includes(id));
			if (invalidTracks.length > 0) {
				return NextResponse.json(
					{ error: `Invalid track IDs: ${invalidTracks.join(", ")}` },
					{ status: 400 }
				);
			}
		}

		// Create or update the project
		let finalProjectId = projectId as string | undefined;
		let projectData:
			| {
				id: string;
				project_name: string | null;
				lead_name: string;
				lead_email: string | null;
				project_description: string | null;
				teammates: string[] | null;
				project_url: string | null;
				cover_image_url: string | null;
				additional_materials_url: string | null;
				event_id: string | null;
				video_url: string | null;
				submitted?: boolean | null;
				submitted_at?: string | null;
				contextus_project_id?: string | null;
			}
			| undefined;

		if (!finalProjectId) {
			const { data: project, error: projectError } = await supabase
				.from("projects")
				.insert({
					project_name: projectName,
					lead_name: leadName,
					lead_email: leadEmail,
					project_description: projectDescription,
					teammates: teammates || [],
					project_url: projectUrl || null,
					cover_image_url: coverImageUrl || null,
					additional_materials_url: additionalMaterialsUrl || null,
					event_id: eventId || null,
					video_url: videoUrl || null,
					submitted: true,
					submitted_at: new Date().toISOString(),
				})
				.select()
				.single();
			if (projectError) {
				return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
			}
			finalProjectId = project.id;
			projectData = project;
		} else {
			const { error: updateError } = await supabase
				.from("projects")
				.update({
					project_name: projectName,
					lead_name: leadName,
					lead_email: leadEmail,
					project_description: projectDescription,
					teammates: teammates || [],
					project_url: projectUrl || null,
					cover_image_url: coverImageUrl || null,
					additional_materials_url: additionalMaterialsUrl || null,
					video_url: videoUrl || null,
					submitted: true,
					submitted_at: new Date().toISOString(),
				})
				.eq("id", finalProjectId);
			if (updateError) {
				return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
			}

			const { data: updatedProject } = await supabase
				.from("projects")
				.select()
				.eq("id", finalProjectId)
				.single();
			projectData = updatedProject as typeof projectData;
		}

		// Manage track relationships only when event context exists
		if (eventId && trackIds && trackIds.length > 0) {
			await supabase.from("project_tracks").delete().eq("project_id", finalProjectId!);
			const trackInserts = trackIds.map((trackId: string) => ({ project_id: finalProjectId!, track_id: trackId }));
			const { error: trackInsertError } = await supabase.from("project_tracks").insert(trackInserts);
			if (trackInsertError) {
				if (!projectId) {
					await supabase.from("projects").delete().eq("id", finalProjectId!);
				}
				return NextResponse.json({ error: "Failed to create project track relationships" }, { status: 500 });
			}
		}

		// Create project in Contextus (best-effort, non-blocking failure)
		let contextusId: string | null = null;
		const { data: existingCtx } = await supabase
			.from("projects")
			.select("contextus_project_id")
			.eq("id", finalProjectId!)
			.single();
		if (existingCtx?.contextus_project_id) {
			contextusId = existingCtx.contextus_project_id as string;
		} else {
			try {
				const label = projectName || leadName || "Project";
				const contextusPayload = {
					label,
					metadata: {
						mentor_mates_project_id: finalProjectId!,
						team_lead_name: leadName as string,
						team_lead_email: leadEmail as string,
						...(eventId ? { event_id: eventId } : {}),
					},
					artifacts: projectUrl
						? { type: "link", title: "Project Repository", url: projectUrl }
						: { type: "doc", title: projectDescription ? projectDescription.slice(0, 100) : "Project" },
				};
				contextusId = await createContextusProject(contextusPayload);
			} catch (contextusError) {
				console.error("Error creating Contextus project:", contextusError);
			}
		}

		if (contextusId) {
			const { error: updateError } = await supabase
				.from("projects")
				.update({ contextus_project_id: contextusId })
				.eq("id", finalProjectId!);
			if (updateError) {
				console.error("Error updating project with Contextus ID:", updateError);
			}
		}

		const finalProject = contextusId && projectData ? { ...projectData, contextus_project_id: contextusId } : projectData;
		return NextResponse.json({ data: finalProject || { id: finalProjectId } });
	} catch (error) {
		console.error("Error in project submission:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}