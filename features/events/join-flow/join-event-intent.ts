import { EventRole } from "@/lib/types";

export const JOIN_EVENT_INTENT_STORAGE_KEY = "joinEventIntent";

const VALID_EVENT_ROLES = new Set<string>(Object.values(EventRole));

export interface JoinEventIntent {
  type: "event_join";
  eventId: string;
  role: EventRole;
  password?: string;
  userId?: string;
  pricingTierId?: string;
  createdAt: string;
}

export function createJoinEventIntent({
  eventId,
  role,
  password,
  userId,
  pricingTierId,
}: Omit<JoinEventIntent, "type" | "createdAt">): JoinEventIntent {
  return {
    type: "event_join",
    eventId,
    role,
    password: password || undefined,
    userId: userId || undefined,
    pricingTierId: pricingTierId || undefined,
    createdAt: new Date().toISOString(),
  };
}

export function parseJoinEventIntent(value: string | null): JoinEventIntent | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<JoinEventIntent>;

    if (
      parsed.type !== "event_join" ||
      typeof parsed.eventId !== "string" ||
      !parsed.eventId ||
      typeof parsed.role !== "string" ||
      !VALID_EVENT_ROLES.has(parsed.role)
    ) {
      return null;
    }

    return {
      type: "event_join",
      eventId: parsed.eventId,
      role: parsed.role as EventRole,
      password:
        typeof parsed.password === "string" && parsed.password
          ? parsed.password
          : undefined,
      userId:
        typeof parsed.userId === "string" && parsed.userId
          ? parsed.userId
          : undefined,
      pricingTierId:
        typeof parsed.pricingTierId === "string" && parsed.pricingTierId
          ? parsed.pricingTierId
          : undefined,
      createdAt:
        typeof parsed.createdAt === "string" && parsed.createdAt
          ? parsed.createdAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function readJoinEventIntent(): JoinEventIntent | null {
  if (typeof window === "undefined") return null;

  return parseJoinEventIntent(
    localStorage.getItem(JOIN_EVENT_INTENT_STORAGE_KEY)
  );
}

export function writeJoinEventIntent(intent: JoinEventIntent) {
  if (typeof window === "undefined") return;

  localStorage.setItem(JOIN_EVENT_INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function clearJoinEventIntent(eventId?: string) {
  if (typeof window === "undefined") return;

  if (!eventId) {
    localStorage.removeItem(JOIN_EVENT_INTENT_STORAGE_KEY);
    return;
  }

  const intent = readJoinEventIntent();
  if (intent?.eventId === eventId) {
    localStorage.removeItem(JOIN_EVENT_INTENT_STORAGE_KEY);
  }
}
