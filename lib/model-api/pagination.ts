import { z } from "zod";
import { ModelApiError } from "./http";

const cursorSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

export function cursorFilter(cursor: string) {
  try {
    if (cursor.length > 512) throw new Error("Cursor too long");
    const decoded = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`;
  } catch {
    throw new ModelApiError(400, "invalid_cursor", "Invalid pagination cursor.");
  }
}

export function nextCursor<T extends { created_at: string; id: string }>(rows: T[], pageSize: number) {
  const last = rows[pageSize - 1];
  return rows.length > pageSize && last
    ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString("base64url")
    : null;
}
