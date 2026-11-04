import {
  createModelKey,
  listModelKeys,
  managementResponse,
  revokeModelKey,
} from "@/lib/model-api/management";

export const runtime = "nodejs";
export const POST = (request: Request) =>
  managementResponse(() => createModelKey(request));
export const GET = (request: Request) => managementResponse(() => listModelKeys(request));
export const DELETE = (request: Request) =>
  managementResponse(() => revokeModelKey(request));
