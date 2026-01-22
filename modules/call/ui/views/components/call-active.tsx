import Link from "next/link";
import Image from "next/image";
import ScreenCapture from "./screen-capture";
import { SpeakerLayout, CallControls } from "@stream-io/video-react-sdk";
import { useCallback, useState } from "react";

interface Props {
    onLeave: () => void;
    meetingId: string;
    meetingName: string;
};
export const CallActive = ({ onLeave, meetingName, meetingId }: Props) => {
    const [disabled, setDisabled] = useState(false);
    const [paused, setPaused] = useState(false);

    const handleTogglePause = useCallback(async () => {
        if (disabled) return;
        setDisabled(true);
        const endpoint = paused ? "/api/agent/resume" : "/api/agent/pause";
        try {
            await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meetingId }),
            });
            setPaused(!paused);
        } catch (err) {
            // fail silently
        }

        // brief disabled/loading state so the user sees the button was pressed
        setTimeout(() => setDisabled(false), 400);
    }, [meetingId, disabled, paused]);

    // Toggle Pause/Resume button component
    const PauseAgentButton = ({ onClick, disabledState, pausedState }: { onClick: () => void; disabledState: boolean; pausedState: boolean }) => {
        const base = "flex items-center justify-center w-10 h-10 rounded-full transition-all";
        const activeClass = pausedState ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-600 text-white hover:bg-red-700";
        const disabledClass = disabledState ? "opacity-60 pointer-events-none" : "";
        const label = pausedState ? 'Resume Agent' : 'Pause Agent';
        const title = label;
        const icon = pausedState ? '▶' : '||';
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

    return (
        <div className="flex flex-col justify-between p-4 h-full text-white">
            <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
                <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
                    <Image src="/favicon.ico" width={22} height={22} alt="logo" />
                </Link>
                <h4 className="text-base">{meetingName}</h4>
            </div>
            <SpeakerLayout />
            <ScreenCapture meetingId={meetingId} />
            <div className="bg-[#101213] rounded-full px-4 flex justify-center">
                <div className="flex items-center gap-4 py-2">
                    <PauseAgentButton onClick={handleTogglePause} disabledState={disabled} pausedState={paused} />
                    <CallControls onLeave={onLeave} />
                </div>
            </div>
        </div>
    );
};
