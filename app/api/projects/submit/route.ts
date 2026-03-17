import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
	buildArtifactsFromLegacy,
	coerceSubmissionAnswerValue,
	deriveLegacySubmissionFieldsFromArtifacts,
	normalizeProjectArtifacts,
	submissionAnswerInputSchema,
} from "@/features/projects/utils/submission";
import {
	buildNullLegacyProjectPayload,
} from "@/features/projects/utils/effectiveSubmission";

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
				artifacts,
				submissionAnswers,
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
				artifacts?: unknown;
				submissionAnswers?: unknown;
			};

			const normalizedArtifacts = normalizeProjectArtifacts(artifacts);
			const compatibilityArtifacts =
				normalizedArtifacts.length > 0
					? normalizedArtifacts
					: buildArtifactsFromLegacy({
							project_url: projectUrl ?? null,
							video_url: videoUrl ?? null,
							additional_materials_url: additionalMaterialsUrl ?? null,
						});

			const legacyFields =
				deriveLegacySubmissionFieldsFromArtifacts(compatibilityArtifacts);

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

			const { data: configuredSubmissionFields, error: configuredSubmissionFieldsError } =
				eventId
					? await supabase
							.from("event_submission_fields")
							.select("id, event_id, key, field_type, is_active")
							.eq("event_id", eventId)
							.eq("is_active", true)
							.order("sort_order", { ascending: true })
					: { data: [], error: null };

			if (configuredSubmissionFieldsError) {
				return NextResponse.json(
					{ error: "Failed to fetch submission field configuration" },
					{ status: 500 }
				);
			}

			const hasConfiguredSubmissionFields =
				(configuredSubmissionFields || []).length > 0;

			const parsedAnswers = Array.isArray(submissionAnswers)
				? submissionAnswers
						.map((item) => submissionAnswerInputSchema.safeParse(item))
						.filter((item) => item.success)
						.map((item) => item.data)
				: [];

			const normalizedSubmissionAnswers: Array<{
				project_id: string;
				event_submission_field_id: string;
				answer: string | string[];
			}> = [];

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
							...(hasConfiguredSubmissionFields
								? buildNullLegacyProjectPayload()
								: {
										project_name: projectName,
										project_description: projectDescription,
										project_url: legacyFields.project_url,
										cover_image_url: coverImageUrl || null,
										additional_materials_url: legacyFields.additional_materials_url,
										video_url: legacyFields.video_url,
									}),
							lead_name: leadName,
							lead_email: leadEmail,
							teammates: teammates || [],
							event_id: eventId || null,
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
							...(hasConfiguredSubmissionFields
								? buildNullLegacyProjectPayload()
								: {
										project_name: projectName,
										project_description: projectDescription,
										project_url: legacyFields.project_url,
										cover_image_url: coverImageUrl || null,
										additional_materials_url: legacyFields.additional_materials_url,
										video_url: legacyFields.video_url,
									}),
							lead_name: leadName,
							lead_email: leadEmail,
							teammates: teammates || [],
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

				if (!hasConfiguredSubmissionFields) {
					// Legacy artifacts are only maintained for events without a configured submission schema.
					const { error: deleteArtifactsError } = await supabase
						.from("project_artifacts")
						.delete()
						.eq("project_id", finalProjectId!);
					if (deleteArtifactsError) {
						return NextResponse.json({ error: "Failed to update project artifacts" }, { status: 500 });
					}

					if (compatibilityArtifacts.length > 0) {
						const { error: insertArtifactsError } = await supabase.from("project_artifacts").insert(
							compatibilityArtifacts.map((artifact) => ({
								project_id: finalProjectId!,
								kind: artifact.kind,
								label: artifact.label,
								url: artifact.url,
								sort_order: artifact.sort_order,
								is_primary: artifact.is_primary,
								metadata: artifact.metadata,
							}))
						);
						if (insertArtifactsError) {
							return NextResponse.json({ error: "Failed to save project artifacts" }, { status: 500 });
						}
					}
				}

				if (hasConfiguredSubmissionFields) {
					const projectEventId = projectData?.event_id || eventId || null;
					if (!projectEventId) {
						return NextResponse.json(
							{ error: "Submission answers require the project to belong to an event" },
							{ status: 400 }
						);
					}

					const fieldById = new Map(
						(configuredSubmissionFields || []).map((field) => [
							field.id,
							field.field_type as
								| "short_text"
								| "long_text"
								| "url"
								| "multi_url"
								| "file"
								| "select"
								| "multi_select"
								| "checkbox",
						])
					);

					const answerFieldIds = [
						...new Set(parsedAnswers.map((answer) => answer.eventSubmissionFieldId)),
					];
					if (answerFieldIds.some((fieldId) => !fieldById.has(fieldId))) {
						return NextResponse.json(
							{ error: "Invalid submission field IDs" },
							{ status: 400 }
						);
					}

					for (const answer of parsedAnswers) {
						const fieldType = fieldById.get(answer.eventSubmissionFieldId);
						if (!fieldType) {
							continue;
						}

						const coerced = coerceSubmissionAnswerValue(fieldType, answer.answer);
						if (coerced === null) {
							continue;
						}
						if (typeof coerced === "string" && coerced.length === 0) {
							continue;
						}
						if (Array.isArray(coerced) && coerced.length === 0) {
							continue;
						}

						normalizedSubmissionAnswers.push({
							project_id: finalProjectId!,
							event_submission_field_id: answer.eventSubmissionFieldId,
							answer: coerced,
						});
					}
				}

				if (submissionAnswers !== undefined || hasConfiguredSubmissionFields) {
					const { error: deleteAnswersError } = await supabase
						.from("project_submission_answers")
						.delete()
						.eq("project_id", finalProjectId!);
					if (deleteAnswersError) {
						return NextResponse.json(
							{ error: "Failed to update submission answers" },
							{ status: 500 }
						);
					}

					if (normalizedSubmissionAnswers.length > 0) {
						const { error: insertAnswersError } = await supabase
							.from("project_submission_answers")
							.insert(normalizedSubmissionAnswers);
						if (insertAnswersError) {
							return NextResponse.json(
								{ error: "Failed to save submission answers" },
								{ status: 500 }
							);
						}
					}
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
						artifacts: legacyFields.project_url
							? { type: "link", title: "Project Repository", url: legacyFields.project_url }
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
