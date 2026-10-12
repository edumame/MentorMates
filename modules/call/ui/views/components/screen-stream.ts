function property(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function resolveCandidateStream(candidate: unknown): MediaStream | null {
  if (typeof MediaStream === "undefined" || !candidate) return null;
  if (candidate instanceof MediaStream) return candidate;
  const stream = property(candidate, "stream");
  if (stream instanceof MediaStream) return stream;
  const mediaStream = property(candidate, "mediaStream");
  if (mediaStream instanceof MediaStream) return mediaStream;
  const tracks = property(candidate, "tracks");
  if (Array.isArray(tracks) && typeof MediaStreamTrack !== "undefined" &&
      tracks.every((track) => track instanceof MediaStreamTrack)) {
    try { return new MediaStream(tracks); } catch { return null; }
  }
  return null;
}

export function resolveScreenStreamFromParticipant(participant: unknown): MediaStream | null {
  return resolveCandidateStream(property(participant, "screenShareStream")) ||
    resolveCandidateStream(property(property(participant, "screenShare"), "stream")) ||
    resolveCandidateStream(property(property(property(participant, "publishedTracks"), "screenShare"), "stream")) ||
    resolveCandidateStream(property(property(participant, "streams"), "screenShare"));
}
