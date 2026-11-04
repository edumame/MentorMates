import type { Json } from "@/lib/database.types";

export type ModelKey = {
  id: string;
  user_id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type ModelRequestRecord = {
  id: string;
  user_id: string;
  key_id: string | null;
  requested_model: string | null;
  resolved_model: string | null;
  provider: string | null;
  request_body: Json | null;
  response_body: Json | null;
  state: "pending" | "succeeded" | "failed";
  http_status: number | null;
  upstream_status: number | null;
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
};

export type ModelRequestSummary = Omit<
  ModelRequestRecord,
  "request_body" | "response_body" | "user_id"
>;
export type KeyPage = { keys: ModelKey[]; next_cursor: string | null };
export type RequestPage = {
  requests: ModelRequestSummary[];
  next_cursor: string | null;
};

export const KEY_COLUMNS =
  "id,user_id,key_prefix,label,created_at,expires_at,revoked_at,last_used_at";
export const REQUEST_COLUMNS =
  "id,key_id,requested_model,resolved_model,provider,state,http_status,upstream_status,error_code,input_tokens,output_tokens,duration_ms,created_at,completed_at";
