"use client";

import { useCallback, useRef } from "react";

/** Short percussive clap via Web Audio — no asset file needed. */
export function useClapSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const playClapAt = useCallback((ctx: AudioContext, offset = 0, volume = 0.9) => {
    const now = ctx.currentTime + offset;

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.8);
    }
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = offset > 0 ? 900 : 1400;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);
  }, []);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }, []);

  const playClap = useCallback(() => {
    try {
      playClapAt(ensureContext());
    } catch {
      // Audio may be blocked until user gesture — fail silently.
    }
  }, [ensureContext, playClapAt]);

  /** Double-hit slap for the high-five moment */
  const playHighFive = useCallback(() => {
    try {
      const ctx = ensureContext();
      playClapAt(ctx, 0, 1);
      playClapAt(ctx, 0.06, 0.75);
    } catch {
      // fail silently
    }
  }, [ensureContext, playClapAt]);

  return { playClap, playHighFive };
}
