import Link from "next/link";
import Image from "next/image";
import ScreenCapture from "./screen-capture";
import { SpeakerLayout, CallControls, useCall } from "@stream-io/video-react-sdk";
import { useCallback, useState, useEffect, useRef } from "react";

interface Props {
  onLeave: () => void;
  meetingId: string;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName, meetingId }: Props) => {
  const [disabled, setDisabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const call = useCall();

  // Agent-only captions state (sourced from worker)
  const [captions, setCaptions] = useState<string>("");
  // UI toggle only — show or hide captions text locally
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const lastTextRef = useRef("");

  const handleTogglePause = useCallback(async () => {
    if (disabled) return;
    setDisabled(true);
    const endpoint = paused ? `/api/agent/resume` : `/api/agent/pause`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setPaused(!paused);
    } catch (err) {
      console.error(err);
    }

    // brief disabled/loading state so the user sees the button was pressed
    setTimeout(() => setDisabled(false), 400);
  }, [meetingId, disabled, paused]);

  useEffect(() => {
    // nothing else needed here — we intentionally don't tie UI toggle to SDK calls
  }, [captionsEnabled]);

  // UI-only toggle: show/hide text. Do NOT call Stream APIs here.
  const handleToggleCaptions = useCallback(() => {
    setCaptionsEnabled((v) => !v);
  }, []);

  // Poll the server for the latest agent caption (fast poll for low-latency)
  useEffect(() => {
    let mounted = true;
    let polling = true;

    const poll = async () => {
      try {
        const res = await fetch(`https://mentormates-dev.onrender.com/captions/receive?meetingId=${meetingId}`);
        if (!mounted || !polling) return;
        if (!res.ok) return;
        const body = await res.json();
        const text = (body && body.text) || "";
        // Update caption even if empty (to clear it)
        if (text !== lastTextRef.current) {
          lastTextRef.current = text;
          setCaptions(text);
        }
      } catch (e) {
        // ignore transient errors
      }
    };

    // 100ms poll for very low latency (adjustable)
    const loop = async () => {
      while (mounted && polling) {
        // fire and forget
        // eslint-disable-next-line no-await-in-loop
        await poll();
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    loop();

    return () => {
      mounted = false;
      polling = false;
    };
  }, [meetingId]);

  // Toggle Pause/Resume button component
  const PauseAgentButton = ({
    onClick,
    disabledState,
    pausedState,
  }: {
    onClick: () => void;
    disabledState: boolean;
    pausedState: boolean;
  }) => {
    const base =
      "flex items-center justify-center w-10 h-10 rounded-full transition-all";
    const activeClass = pausedState
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-red-600 text-white hover:bg-red-700";
    const disabledClass = disabledState ? "opacity-60 pointer-events-none" : "";
    const label = pausedState ? "Resume Agent" : "Pause Agent";
    const title = label;
    const icon = pausedState ? "▶" : "||";
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={title}
        className={`${base} ${activeClass} ${disabledClass}`}
      >
        <span className="text-sm font-medium select-none">{icon}</span>
      </button>
    );
  };

  // Captions toggle button
  const CaptionsToggleButton = ({ onClick, enabled }: { onClick: () => void; enabled: boolean }) => {
    const base = "flex items-center justify-center w-10 h-10 rounded-full transition-all";
    // Brighter background when ON, darker when OFF
    const activeClass = enabled
      ? "bg-white/60 text-white hover:bg-white/70"
      : "bg-white/10 text-white hover:bg-white/20";
    const label = enabled ? "Turn captions off" : "Turn captions on";
    const icon = "CC";
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`${base} ${activeClass}`}
      >
        <span className="text-sm font-medium select-none">{icon}</span>
      </button>
    );
  };

  return (
    <div className="relative flex flex-col justify-between p-4 h-full text-white">
      <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit"
        >
          <Image src="/favicon.ico" width={22} height={22} alt="logo" />
        </Link>
        <h4 className="text-base">{meetingName}</h4>
      </div>
      <SpeakerLayout />
      <ScreenCapture meetingId={meetingId} />

      <div className="absolute left-0 right-0 bottom-20 flex justify-center pointer-events-none">
        <div
          className={`bg-black/70 text-white px-4 py-2 rounded-md max-w-[90vw] text-center text-sm ${
            captionsEnabled && captions ? "" : "hidden"
          }`}
        >
          {captionsEnabled && captions ? captions : ""}
        </div>
      </div>

      <div className="bg-[#101213] rounded-full px-4 flex justify-center">
        <div className="flex items-center gap-4 py-2">
          <CaptionsToggleButton onClick={handleToggleCaptions} enabled={captionsEnabled} />
          <PauseAgentButton
            onClick={handleTogglePause}
            disabledState={disabled}
            pausedState={paused}
          />
          <CallControls onLeave={onLeave} />
        </div>
      </div>
    </div>
  );
};
