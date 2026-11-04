import {
  listModelRequests,
  managementResponse,
} from "@/lib/model-api/management";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  managementResponse(() => listModelRequests(request));
