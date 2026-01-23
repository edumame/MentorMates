import { useState } from "react";
import { StreamTheme, useCall } from "@stream-io/video-react-sdk";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingId: string;
  meetingName: string;
}

export const CallUI = ({ meetingId, meetingName }: Props) => {
  const call = useCall();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");

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

  const handleAgentPause = () => {
    if (!call) return;

    call.sendCustomEvent({
      type: "agent_pause",
      data: {
        callId: call.id,
        meetingId: meetingId,
      },
    });
  };

  const handleAgentResume = () => {
    if (!call) return;

    call.sendCustomEvent({
      type: "agent_resume",
      data: {
        callId: call.id,
        meetingId: meetingId,
      },
    });
  };

  return (
    <StreamTheme className="h-[95%]">
      {show === "lobby" && <CallLobby onJoin={handleJoin} />}
      {show === "call" && (
        <CallActive
          onLeave={handleLeave}
          onPause={handleAgentPause}
          onResume={handleAgentResume}
          meetingId={meetingId}
          meetingName={meetingName}
        />
      )}
      {show === "ended" && <CallEnded />}
    </StreamTheme>
  );
};
