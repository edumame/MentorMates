import { useState } from "react";
import { StreamTheme, useCall } from "@stream-io/video-react-sdk";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
    meetingId: string;
    meetingName: string;
};

export const CallUI = ({ meetingId, meetingName }: Props) => {
    const call = useCall();
    const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
    const [isQAMode, setIsQAMode] = useState(false);
    const [isStartingQA, setIsStartingQA] = useState(false);

    const handleJoin = async () => {
        if (!call) return;

        await call.join();
        setShow("call");
    };

    const handleLeave = () => {
        if (!call) return;

        call.endCall();
        setShow("ended");
    };

    const handleStartQA = async () => {
        setIsStartingQA(true);
        try {
            const response = await fetch(`/api/meetings/${meetingId}/start-qa`, {
                method: "POST",
            });
            if (response.ok) {
                setIsQAMode(true);
            } else {
                console.error("Failed to start Q&A");
            }
        } catch (error) {
            console.error("Error starting Q&A:", error);
        } finally {
            setIsStartingQA(false);
        }
    };

    return (
        <StreamTheme className="h-[95%]">
            {show === "lobby" && <CallLobby onJoin={handleJoin} />}
            {show === "call" && (
                <CallActive
                    onLeave={handleLeave}
                    meetingName={meetingName}
                    isQAMode={isQAMode}
                    isStartingQA={isStartingQA}
                    onStartQA={handleStartQA}
                />
            )}
            {show === "ended" && <CallEnded />}
        </StreamTheme>
    )
};
