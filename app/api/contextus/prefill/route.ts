import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

// Fields expected by the MentorMates project submission form
export type PrefillData = {
	projectName?: string;
	projectDescription?: string;
	teammates?: string[];
	projectUrl?: string;
	videoUrl?: string;
};

// Minimal types based on Contextus Query response example
interface ContextusQueryLinks {
	github?: string;
	video?: string;
	website?: string;
	[key: string]: unknown;
}

interface ContextusQueryMetadata {
	mentor_mates_project_id?: string;
	team_lead_name?: string;
	team_lead_email?: string;
	event_id?: string;
	project_description?: string;
	github_url?: string;
	video_url?: string;
	project_url?: string;
	team?: string | string[];
	team_members?: string | string[];
	teammates?: string | string[];
	members?: string | string[];
	[key: string]: unknown;
}

interface ContextusQueryOverview {
	summary?: string;
	[key: string]: unknown;
}

interface ContextusQueryResponseDTO {
	project_id?: string;
	label?: string;
	description?: string;
	metadata?: ContextusQueryMetadata;
	links?: ContextusQueryLinks;
	artifacts?: Array<{ type?: string; title?: string; url?: string }>;
	overview?: ContextusQueryOverview;
	[key: string]: unknown;
}

interface ContextusQueryResult {
	project_id?: string;
	query_response?: ContextusQueryResponseDTO;
	[key: string]: unknown;
}

function normalizeTeammates(meta?: ContextusQueryMetadata): string[] | undefined {
	if (!meta) return undefined;
	const candidate = (meta.team_members ?? meta.teammates ?? meta.members ?? meta.team) as unknown;
	let list: string[] = [];
	if (Array.isArray(candidate)) {
		list = candidate.filter((x): x is string => typeof x === "string");
	} else if (typeof candidate === "string") {
		list = candidate
			.split(/,|\n|\r|;/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return list.length ? list : undefined;
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { projectId, eventId, leadEmail } = body as {
			projectId?: string; // internal MentorMates project id
			eventId?: string;
			leadEmail?: string;
		};

		if (!projectId && !(eventId && leadEmail)) {
			return NextResponse.json({ error: "Missing projectId or eventId+leadEmail" }, { status: 400 });
		}

		const supabase = await createSupabaseClient();
		let contextusProjectId: string | null = null;

		if (projectId) {
			const { data, error } = await supabase
				.from("projects")
				.select("contextus_project_id")
				.eq("id", projectId)
				.maybeSingle();
			if (error) {
				return NextResponse.json({ error: "Failed to fetch project" }, { status: 400 });
			}
			contextusProjectId = (data as unknown as { contextus_project_id?: string | null })?.contextus_project_id ?? null;
		} else if (eventId && leadEmail) {
			const { data, error } = await supabase
				.from("projects")
				.select("id, contextus_project_id")
				.eq("event_id", eventId)
				.eq("lead_email", leadEmail)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();
			if (error) {
				return NextResponse.json({ error: "Failed to resolve current project" }, { status: 400 });
			}
			contextusProjectId = (data as unknown as { contextus_project_id?: string | null })?.contextus_project_id ?? null;
		}

		if (!contextusProjectId) {
			return NextResponse.json({ error: "No Contextus project linked to current project" }, { status: 404 });
		}

		const BASE = process.env.CONTEXTUS_BASE_URL || "https://www.contextus.space";

		// Call the Contextus Query endpoint per provided example
		const queryRes = await fetch(`${BASE}/v1/projects/${contextusProjectId}/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ q: "tell me about this project" }),
		});

		if (!queryRes.ok) {
			const raw = await queryRes.text().catch(() => "");
			return NextResponse.json(
				{ error: `Contextus Query failed: ${queryRes.status}`, raw },
				{ status: 502 }
			);
		}

		const json = (await queryRes.json()) as ContextusQueryResult;
		const qr: ContextusQueryResponseDTO | undefined = json.query_response ?? (json as unknown as ContextusQueryResponseDTO);
		if (!qr) {
			return NextResponse.json(
				{ error: "Contextus Query did not return expected query_response" },
				{ status: 502 }
			);
		}

		// Map to our form fields
		const out: PrefillData = {};
		if (qr.label && typeof qr.label === "string") out.projectName = qr.label;

		const meta = qr.metadata;
		const links = qr.links;

		// Description precedence: metadata.project_description > description > overview.summary
		const desc = (meta?.project_description as string | undefined) ||
			(qr.description ?? undefined) ||
			(qr.overview?.summary ?? undefined);
		if (desc && typeof desc === "string") out.projectDescription = desc;

		// Project URL precedence: metadata.github_url > links.github > metadata.project_url > links.website
		const projectUrlCandidate =
			(meta?.github_url as string | undefined) ||
			(links?.github as string | undefined) ||
			(meta?.project_url as string | undefined) ||
			(links?.website as string | undefined);
		if (projectUrlCandidate && typeof projectUrlCandidate === "string") out.projectUrl = projectUrlCandidate;

		// Video URL precedence: metadata.video_url > links.video
		const videoUrlCandidate =
			(meta?.video_url as string | undefined) ||
			(links?.video as string | undefined);
		if (videoUrlCandidate && typeof videoUrlCandidate === "string") out.videoUrl = videoUrlCandidate;

		// Teammates from metadata team fields (do not auto-include team lead by default)
		const teammates = normalizeTeammates(meta);
		if (teammates && teammates.length) out.teammates = teammates;

		return NextResponse.json({ success: true, data: out });
	} catch (error) {
		console.error("/api/contextus/prefill error", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}