import Link from "next/link";
import Image from "next/image";
import ScreenCapture from "./screen-capture";
import { SpeakerLayout, CallControls } from "@stream-io/video-react-sdk";
import { useCallback, useEffect, useState } from "react";

interface Props {
  onLeave: () => void;
  meetingId: string;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName, meetingId }: Props) => {
  const [disabled, setDisabled] = useState(false);
  // Default: agent starts paused until the user explicitly resumes.
  const [paused, setPaused] = useState(true);

  // Defensive: ensure the worker session is paused once it’s available.
  // The worker also defaults sessions to paused, but this guards against older workers.
  useEffect(() => {
    let cancelled = false;

    const ensurePaused = async () => {
      // If the UI says we’re not paused, don’t force it.
      if (!paused) return;

      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;
        try {
          const resp = await fetch("/api/agent/pause", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId }),
          });

          if (resp.ok) return;
        } catch {
          // ignore and retry
        }

        // Backoff: 250ms, 500ms, 1000ms, 2000ms, 4000ms
        const delayMs = 250 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    };

    void ensurePaused();

    return () => {
      cancelled = true;
    };
  }, [meetingId, paused]);

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

  // Toggle Pause/Resume button component
  const AgentToggleButton = ({
    onClick,
    disabledState,
    pausedState,
  }: {
    onClick: () => void;
    disabledState: boolean;
    pausedState: boolean;
  }) => {
    const base =
      "flex items-center justify-center h-10 rounded-full transition-all px-3 gap-2";
    const activeClass = pausedState
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-red-600 text-white hover:bg-red-700";
    const disabledClass = disabledState ? "opacity-60 pointer-events-none" : "";
    const label = pausedState ? "Start asking me questions" : "Pause Agent";
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
        <span className="hidden sm:inline text-sm font-medium">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col justify-between p-4 h-full text-white">
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
      <div className="bg-[#101213] rounded-full px-4 flex justify-center">
        <div className="flex items-center gap-4 py-2">
          <AgentToggleButton
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
