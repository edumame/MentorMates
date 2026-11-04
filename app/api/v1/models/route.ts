import { authenticateModelKey } from "@/lib/model-api/auth";
import { jsonResponse } from "@/lib/model-api/http";
import { managementResponse } from "@/lib/model-api/management";
import { listModels } from "@/lib/model-api/providers";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return managementResponse(async () => {
    await authenticateModelKey(request);
    return jsonResponse({ models: listModels() });
  });
}
