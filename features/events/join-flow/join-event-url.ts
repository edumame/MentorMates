export const JOIN_EVENT_FLOW_QUERY_PARAM = "joinEventFlow";
export const JOIN_EVENT_FLOW_RESUME_STATE = "resume";

// Only pathname/search/hash are ever read back, so a fixed base is enough.
// Do not read window at module scope: this module is imported by client
// components that are also server-rendered.
const LOCAL_URL_BASE = "http://localhost";

function toLocalUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return null;

  try {
    const url = new URL(path, LOCAL_URL_BASE);
    return url.origin === LOCAL_URL_BASE ? url : null;
  } catch {
    return null;
  }
}

function toPath(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function addJoinEventFlowQuery(path: string | null | undefined) {
  if (!path) return null;

  const url = toLocalUrl(path);
  if (!url) return null;

  url.searchParams.set(
    JOIN_EVENT_FLOW_QUERY_PARAM,
    JOIN_EVENT_FLOW_RESUME_STATE
  );

  return toPath(url);
}

export function hasJoinEventFlowQuery(search: string | null | undefined) {
  if (!search) return false;

  const searchParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  return (
    searchParams.get(JOIN_EVENT_FLOW_QUERY_PARAM) ===
    JOIN_EVENT_FLOW_RESUME_STATE
  );
}

export function removeJoinEventFlowQuery(path: string | null | undefined) {
  if (!path) return null;

  const url = toLocalUrl(path);
  if (!url) return null;

  url.searchParams.delete(JOIN_EVENT_FLOW_QUERY_PARAM);

  return toPath(url);
}
