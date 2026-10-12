import { resolveCandidateStream, resolveScreenStreamFromParticipant } from "./screen-stream";

class FakeTrack {}
class FakeStream { constructor(public tracks: FakeTrack[] = []) {} }
const originalStream = globalThis.MediaStream;
const originalTrack = globalThis.MediaStreamTrack;
beforeAll(() => {
  Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: FakeStream });
  Object.defineProperty(globalThis, "MediaStreamTrack", { configurable: true, value: FakeTrack });
});
afterAll(() => {
  Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: originalStream });
  Object.defineProperty(globalThis, "MediaStreamTrack", { configurable: true, value: originalTrack });
});
test("accepts direct streams and supported SDK wrappers", () => {
  const stream = new FakeStream();
  for (const candidate of [stream, { stream }, { mediaStream: stream }]) {
    expect(resolveCandidateStream(candidate)).toBe(stream);
  }
  for (const participant of [
    { screenShareStream: stream }, { screenShare: { stream } },
    { publishedTracks: { screenShare: { stream } } }, { streams: { screenShare: stream } },
  ]) expect(resolveScreenStreamFromParticipant(participant)).toBe(stream);
});
test("constructs a stream only from media tracks", () => {
  const tracks = [new FakeTrack()];
  expect(resolveCandidateStream({ tracks })).toEqual(new FakeStream(tracks));
  for (const candidate of [null, 4, {}, { tracks: ["invalid"] }, { tracks: {} }]) {
    expect(resolveCandidateStream(candidate)).toBeNull();
  }
  expect(resolveScreenStreamFromParticipant(undefined)).toBeNull();
});
