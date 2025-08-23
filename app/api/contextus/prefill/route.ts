import { NextResponse } from "next/server";
import type { ContextusMetadataItem, ContextusArtifactItem } from "@/lib/integrations/contextus";

interface ContextusProject {
	id?: string;
	label?: string;
	name?: string;
	metadata?: ContextusMetadataItem[];
	artifacts?: ContextusArtifactItem[];
	[key: string]: unknown;
}

type PrefillData = {
	projectName?: string;
	projectDescription?: string;
	teammates?: string[];
	projectUrl?: string;
	videoUrl?: string;
	raw?: unknown;
};

// This route fetches a Contextus project by id and returns mapped fields
// for MentorMates NewProjectSubmissionFormSinglePage prefilling.
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { projectId, queryPrompt } = body as {
			projectId?: string;
			queryPrompt?: string;
		};

		if (!projectId) {
			return NextResponse.json(
				{ error: "Missing projectId" },
				{ status: 400 }
			);
		}

		// Base URL can be overridden via env
		const BASE = process.env.CONTEXTUS_BASE_URL || "https://www.contextus.space";

		// 1) Fetch the raw project payload (for metadata/artifacts)
		const projRes = await fetch(`${BASE}/v1/projects/${projectId}`);
		if (!projRes.ok) {
			return NextResponse.json(
				{ error: `Contextus project fetch failed: ${projRes.status}` },
				{ status: 502 }
			);
		}
		const projectData = (await projRes.json()) as ContextusProject;

		// 2) Optionally call the Query endpoint with a default natural language prompt
		// The user requested: "use the Query endpoint, you are query via natural language"
		// If no prompt provided, ask for fields relevant to our form.
		const nlPrompt =
			queryPrompt ||
			"Extract project name, short description, repo or live url, video url, team member names as CSV.";

		const queryRes = await fetch(`${BASE}/v1/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				project_id: projectId,
				query: nlPrompt,
			}),
		});

		let queryAnswer: unknown = null;
		if (queryRes.ok) {
			try {
				queryAnswer = await queryRes.json();
			} catch {
				queryAnswer = await queryRes.text();
			}
		}

		// 3) Heuristic mapping to MentorMates form fields
		// Expected output fields for ProjectSubmissionFormData
		// { projectName, projectDescription, teammates, projectUrl, videoUrl }

		const mapped: PrefillData = { raw: { projectData, queryAnswer } };

		// Pull from common Contextus shapes if present
		const label = (projectData?.label || projectData?.name || "").toString();
		if (label) mapped.projectName = label;

		const meta: ContextusMetadataItem[] = Array.isArray(projectData?.metadata)
			? (projectData.metadata as ContextusMetadataItem[])
			: [];
		const artifacts: ContextusArtifactItem[] = Array.isArray(projectData?.artifacts)
			? (projectData.artifacts as ContextusArtifactItem[])
			: [];

		// description from metadata
		const descMeta = meta.find((m: ContextusMetadataItem) =>
			["description", "summary", "project_description"].includes(m.key.toLowerCase())
		);
		if (descMeta?.value) mapped.projectDescription = String(descMeta.value);

		// repo/live url
		const repoMeta = meta.find((m: ContextusMetadataItem) =>
			["github", "repo", "repository", "project_url", "url", "website"].includes(m.key.toLowerCase())
		);
		if (repoMeta?.value) mapped.projectUrl = String(repoMeta.value);

		// video url from artifacts or metadata
		const videoMeta = meta.find((m: ContextusMetadataItem) =>
			["video", "demo_video", "youtube", "vimeo"].includes(m.key.toLowerCase())
		);
		if (videoMeta?.value) mapped.videoUrl = String(videoMeta.value);

		const videoArtifact = artifacts.find(
			(a: ContextusArtifactItem) =>
				(a.type || "").toLowerCase() === "video" || /(youtube|vimeo)/i.test(String(a.url || ""))
		);
		if (!mapped.videoUrl && videoArtifact?.url) mapped.videoUrl = String(videoArtifact.url);

		// teammates: try metadata first
		const teamMeta = meta.find((m: ContextusMetadataItem) =>
			["team", "team_members", "teammates", "members"].includes(m.key.toLowerCase())
		);
		if (teamMeta?.value) {
			const parts = String(teamMeta.value)
				.split(/,|\n|\r|;/)
				.map((s) => s.trim())
				.filter(Boolean);
			if (parts.length) mapped.teammates = parts;
		}

		return NextResponse.json({ success: true, data: mapped });
	} catch (error) {
		console.error("/api/contextus/prefill error", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}