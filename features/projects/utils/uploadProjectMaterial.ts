import { supabase } from "@/lib/supabase";

const PROJECT_MATERIALS_BUCKET = "project-materials";

/**
 * Uploads a file for a submission field to the shared project-materials bucket
 * (same bucket and folder layout as the participant submission forms) and
 * returns its public URL. Throws on failure so callers can surface an error.
 */
export async function uploadProjectMaterialFile(
  file: File,
  folder: "project-materials" | "project-covers" = "project-materials",
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(PROJECT_MATERIALS_BUCKET)
    .upload(filePath, file);
  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROJECT_MATERIALS_BUCKET).getPublicUrl(filePath);
  return publicUrl;
}
