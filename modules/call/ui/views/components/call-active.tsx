import Link from "next/link";
import Image from "next/image";
import ScreenCapture from "./screen-capture";
import { SpeakerLayout, CallControls } from "@stream-io/video-react-sdk";
import { useCallback, useState, useEffect, useRef } from "react";

interface Props {
  onLeave: () => void;
  meetingId: string;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName, meetingId }: Props) => {
  const [disabled, setDisabled] = useState(false);
  const [paused, setPaused] = useState(false);

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

  // Subscribe to real-time caption updates via SSE
  useEffect(() => {
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_SCREEN_VISION_WORKER_URL}/captions/stream?meetingId=${meetingId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const text = data.text || "";
        // Update caption even if empty (to clear it)
        if (text !== lastTextRef.current) {
          lastTextRef.current = text;
          setCaptions(text);
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
      // Just log for debugging if needed
    };

    return () => {
      eventSource.close();
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
      "flex items-center justify-center h-10 rounded-full px-4 text-sm font-medium transition-all";
    const activeClass = pausedState
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-red-600 text-white hover:bg-red-700";
    const disabledClass = disabledState ? "opacity-60 pointer-events-none" : "";
    const label = pausedState ? "Start Q&A" : "Pause Q&A";
    const title = label;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={title}
        className={`${base} ${activeClass} ${disabledClass}`}
      >
        <span className="select-none">{label}</span>
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
