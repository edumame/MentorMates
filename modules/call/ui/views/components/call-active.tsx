import Link from "next/link";
import Image from "next/image";
import ScreenCapture from "./screen-capture";
import { SpeakerLayout, CallControls } from "@stream-io/video-react-sdk";
import { useCallback, useEffect, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

interface Props {
  onLeave: () => void;
  meetingId: string;
  meetingName: string;
}

export const CallActive = ({ onLeave, meetingName, meetingId }: Props) => {
  const [disabled, setDisabled] = useState(false);
  const [paused, setPaused] = useState(true);
  const [hasSpoken, setHasSpoken] = useState(false);
  // obtain microphone state hook from the SDK
  const { useMicrophoneState } = useCallStateHooks();
  type MicrophoneState = {
    isEnabled?: boolean;
    isPublishing?: boolean;
    isOn?: boolean;
    isMuted?: boolean;
    enabled?: boolean;
    hasBrowserPermission?: boolean;
  };
  const micState: MicrophoneState = (useMicrophoneState?.() as MicrophoneState) ?? {};
  const micOn =
    micState.isEnabled === true ||
    micState.isPublishing === true ||
    micState.isOn === true ||
    micState.isMuted === false ||
    micState.enabled === true;

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
      if (paused) {
        setHasSpoken(false);
      }
      setPaused(!paused);
    } catch (err) {
      console.error(err);
    }

    // brief disabled/loading state so the user sees the button was pressed
    setTimeout(() => setDisabled(false), 400);
  }, [meetingId, disabled, paused]);

  useEffect(() => {
    // only monitor when paused, hasn't spoken yet, and mic is turned on via CallControls
    if (!paused || hasSpoken || !micOn) return;

    let audioCtx: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let raf = 0;

    const startMonitor = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(mediaStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        const check = () => {
          analyser.getByteTimeDomainData(data);
          // compute peak deviation from midpoint (128)
          let max = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128);
            if (v > max) max = v;
          }
          // threshold tuned to detect speech without being too sensitive
          if (max > 18) {
            setHasSpoken(true);
            return;
          }
          raf = requestAnimationFrame(check);
        };

        check();
      } catch (err) {
        console.log(err);
      }
    };

    startMonitor();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [paused, hasSpoken, micOn]);

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
      "flex items-center justify-center h-10 rounded-full transition-all px-3 gap-2";
    const activeClass = pausedState
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-red-600 text-white hover:bg-red-700";
    // keep button disabled when paused AND there is no detected speech yet
    const shouldDisableStart = pausedState && !hasSpoken;
    const disabledClass = disabledState || shouldDisableStart ? "opacity-60 pointer-events-none" : "";
    const label = pausedState ? "Start asking me questions" : "Pause Agent";
    const title = label;
    const icon = pausedState ? "▶" : "||";
    return (
      <button
        type="button"
        disabled={disabledState || (pausedState && !hasSpoken)}
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
