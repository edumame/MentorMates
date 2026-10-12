export const JOIN_EVENT_FLOW_QUERY_PARAM = "joinEventFlow";
export const JOIN_EVENT_FLOW_RESUME_STATE = "resume";

const LOCAL_URL_ORIGIN = window.location.origin;

function toLocalUrl(path: string) {
  if (!path.startsWith("/")) return null;

  try {
    return new URL(path, LOCAL_URL_ORIGIN);
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
