import { readApiError, toError } from "./api-error";

/**
 * Delete a project through the API, which allows the project lead (submitted
 * or not) and organizers of the project's event. Related rows (tracks,
 * scores, likes, ...) are removed by the database's cascading foreign keys.
 */
export async function deleteProjectClient(
  projectId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (!response.ok) {
      return { success: false, error: await readApiError(response, "Failed to delete project") };
    }
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toError(error, "Failed to delete project") };
  }
}
