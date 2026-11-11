import {
  mergeAssistantPatch,
  mergeParsedRubric,
} from "./track-draft";
import type { EventScoringConfig, TrackScoringConfig } from "@/lib/types";

const track = (name: string): TrackScoringConfig => ({ name, criteria: [] });

const a = track("A");
const b = track("B");
const sent: EventScoringConfig = {
  tracks: { a, b },
  defaultMin: 1,
  rounds: [{ round_number: 1, name: "Qualifiers" }],
};

describe("mergeAssistantPatch", () => {
  it("applies patched, new and removed tracks when the draft is unchanged", () => {
    const patchedA = track("A2");
    const added = track("New");

    const merged = mergeAssistantPatch(sent, sent, {
      tracks: { a: patchedA, new_track_1: added },
    });

    expect(merged.tracks).toEqual({ a: patchedA, new_track_1: added });
    expect(merged.rounds).toBe(sent.rounds);
  });

  it("keeps a track edited since the request was sent", () => {
    const edited = track("Edited");
    const current = { ...sent, tracks: { ...sent.tracks, a: edited } };

    const merged = mergeAssistantPatch(current, sent, {
      tracks: { a: track("A2"), b: track("B2") },
    });

    expect(merged.tracks.a).toBe(edited);
    expect(merged.tracks.b.name).toBe("B2");
  });

  it("keeps a track edited since the request even if the patch omits it", () => {
    const edited = track("Edited");
    const current = { ...sent, tracks: { ...sent.tracks, a: edited } };

    expect(mergeAssistantPatch(current, sent, { tracks: { b } }).tracks.a).toBe(
      edited
    );
  });

  it("does not bring back a track deleted since the request was sent", () => {
    const current = { ...sent, tracks: { a } };

    const merged = mergeAssistantPatch(current, sent, { tracks: { a, b } });

    expect(merged.tracks).toEqual({ a });
  });

  it("keeps a track added since the request was sent", () => {
    const added = track("Added");
    const current = { ...sent, tracks: { ...sent.tracks, added } };

    const merged = mergeAssistantPatch(current, sent, { tracks: { a, b } });

    expect(merged.tracks.added).toBe(added);
  });

  it("applies the other patch fields over the current draft", () => {
    const current = { ...sent, defaultMax: 7 };

    const merged = mergeAssistantPatch(current, sent, {
      tracks: { a, b },
      defaultMin: 0,
    });

    expect(merged.defaultMin).toBe(0);
    expect(merged.defaultMax).toBe(7);
  });
});

describe("mergeParsedRubric", () => {
  it("adds parsed tracks and keeps existing tracks and rounds", () => {
    const parsedTrack = track("Parsed");

    const merged = mergeParsedRubric(sent, {
      tracks: { parsed: parsedTrack },
      defaultMin: 0,
      defaultMax: 5,
    });

    expect(merged.tracks).toEqual({ a, b, parsed: parsedTrack });
    expect(merged.rounds).toBe(sent.rounds);
    expect(merged.defaultMax).toBe(5);
  });

  it("does not overwrite a draft track whose id matches a parsed track", () => {
    const parsedTrack = track("Parsed");
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
    });

    const merged = mergeParsedRubric(sent, { tracks: { a: parsedTrack } });

    expect(merged.tracks.a).toBe(a);
    expect(merged.tracks["00000000-0000-4000-8000-000000000000"]).toBe(
      parsedTrack
    );
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });
});
