import { NextResponse } from "next/server";

// Fields expected by the MentorMates project submission form
export type PrefillData = {
	projectName?: string;
	projectDescription?: string;
	teammates?: string[];
	projectUrl?: string;
	videoUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function coercePrefillFromUnknown(value: unknown): PrefillData | null {
	if (!isRecord(value)) return null;
	const out: PrefillData = {};

	if (isString(value.projectName)) out.projectName = value.projectName;
	if (isString(value.projectDescription)) out.projectDescription = value.projectDescription;
	if (isString(value.projectUrl)) out.projectUrl = value.projectUrl;
	if (isString(value.videoUrl)) out.videoUrl = value.videoUrl;

	const teammatesUnknown = (value as Record<string, unknown>).teammates;
	if (Array.isArray(teammatesUnknown)) {
		out.teammates = teammatesUnknown.filter((t): t is string => typeof t === "string");
	} else if (isString(teammatesUnknown)) {
		out.teammates = teammatesUnknown
			.split(/,|\n|\r|;/)
			.map((s) => s.trim())
			.filter(Boolean);
	}

	// Return only if any field was set
	return Object.keys(out).length > 0 ? out : null;
}

function coercePrefillFromPossibleWrapper(value: unknown): PrefillData | null {
	// Try direct
	const direct = coercePrefillFromUnknown(value);
	if (direct) return direct;

	// Common wrappers like { answer: "...json..." } or { result: "..." } or { data: {...} }
	if (isRecord(value)) {
		const answerCandidates: unknown[] = [];
		if ("answer" in value) answerCandidates.push((value as Record<string, unknown>).answer);
		if ("result" in value) answerCandidates.push((value as Record<string, unknown>).result);
		if ("output" in value) answerCandidates.push((value as Record<string, unknown>).output);
		if ("data" in value) answerCandidates.push((value as Record<string, unknown>).data);

		for (const candidate of answerCandidates) {
			if (candidate == null) continue;
			if (isString(candidate)) {
				try {
					const parsed = JSON.parse(candidate) as unknown;
					const inner = coercePrefillFromUnknown(parsed);
					if (inner) return inner;
				} catch {
					// ignore
				}
			}
			const inner = coercePrefillFromUnknown(candidate);
			if (inner) return inner;
		}
	}
	return null;
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { projectId, queryPrompt } = body as {
			projectId?: string;
			queryPrompt?: string;
		};

		if (!projectId) {
			return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
		}

		const BASE = process.env.CONTEXTUS_BASE_URL || "https://www.contextus.space";

		// Instruct Contextus Query to return ONLY valid JSON in the exact shape we need
		const exampleJson = {
			projectName: "Acme AI Assistant",
			projectDescription: "Short description of what the project does and how.",
			teammates: ["Alice Example", "Bob Sample"],
			projectUrl: "https://github.com/acme/ai-assistant",
			videoUrl: "https://youtu.be/dQw4w9WgXcQ",
		};

		const defaultPrompt =
			"Extract the following fields for this project and return ONLY strict JSON with these exact keys. " +
			"If a field is unknown, use an empty string for strings and an empty array for arrays. " +
			"Do not include any extra commentary, markdown, or code fences. " +
			"The keys must be: projectName, projectDescription, teammates, projectUrl, videoUrl.\n" +
			"Example format (values are illustrative):\n" +
			JSON.stringify(exampleJson, null, 2);

		const nlPrompt = queryPrompt && queryPrompt.trim().length > 0 ? `${queryPrompt.trim()}\n\n${defaultPrompt}` : defaultPrompt;

		const queryRes = await fetch(`${BASE}/v1/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project_id: projectId, query: nlPrompt }),
		});

		const rawText = await queryRes.text();
		let parsed: unknown = null;
		let data: PrefillData | null = null;
		try {
			parsed = JSON.parse(rawText) as unknown;
			data = coercePrefillFromPossibleWrapper(parsed);
		} catch {
			// Not JSON, try to locate JSON substring quickly (best-effort)
			const firstBrace = rawText.indexOf("{");
			const lastBrace = rawText.lastIndexOf("}");
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				const candidate = rawText.slice(firstBrace, lastBrace + 1);
				try {
					const inner = JSON.parse(candidate) as unknown;
					data = coercePrefillFromPossibleWrapper(inner);
					parsed = inner;
				} catch {
					// ignore
				}
			}
		}

		if (!queryRes.ok) {
			return NextResponse.json(
				{ error: `Contextus Query failed: ${queryRes.status}`, raw: rawText },
				{ status: 502 }
			);
		}

		if (!data) {
			return NextResponse.json(
				{ error: "Contextus Query did not return valid JSON in the expected format", raw: rawText },
				{ status: 502 }
			);
		}

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error("/api/contextus/prefill error", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}