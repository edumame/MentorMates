export interface ContextusArtifactItem {
  type: string;
  title: string;
  url?: string;
}

export interface CreateContextusProjectInput {
  label: string;
  // Use a single JSON blob for metadata instead of key/value array
  metadata?: Record<string, unknown>;
  artifacts?: ContextusArtifactItem | ContextusArtifactItem[];
}

export interface CreateContextusProjectResponse {
  id?: string;
  project?: { id?: string };
  project_id?: string;
  label?: string;
  [key: string]: unknown;
}

export async function createContextusProject(
  payload: CreateContextusProjectInput
): Promise<string | null> {
  const BASE = process.env.CONTEXTUS_BASE_URL || "https://www.contextus.space";

  try {
    const res = await fetch(`${BASE}/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Contextus create project failed:", res.status, await safeText(res));
      return null;
    }

    const data = (await res.json()) as CreateContextusProjectResponse;
    const id = data?.id || data?.project?.id || data?.project_id || null;
    return id ?? null;
  } catch (error) {
    console.error("Contextus create project error:", error);
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}