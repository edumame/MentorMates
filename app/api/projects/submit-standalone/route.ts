import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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
			videoUrl,
		} = body;

		if (!projectName || !leadName || !leadEmail || !projectDescription) {
			return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
		}

		let finalProjectId = projectId as string | undefined;
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
					event_id: null,
					video_url: videoUrl || null,
					submitted: true,
					submitted_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			if (projectError) {
				return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
			}

			finalProjectId = project.id;
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
		}

		return NextResponse.json({ id: finalProjectId });
	} catch (error) {
		console.error("Error in standalone project submission:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}