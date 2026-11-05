import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CallingState,
  StreamTheme,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingId: string;
  meetingName: string;
  isOwner: boolean;
}

export const CallUI = ({ meetingId, meetingName, isOwner }: Props) => {
  const call = useCall();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  // The SDK leaves the call by itself when it is ended remotely.
  const view = show === "call" && callingState === CallingState.LEFT ? "ended" : show;

  // A client that was offline misses call.ended, and the SDK does not leave by
  // itself after a failed reconnect. It refreshes the call first, so endedAt is
  // current here. Leaving also releases the camera and microphone.
  useEffect(() => {
    if (!call || show !== "call" || callingState !== CallingState.RECONNECTING_FAILED) return;

    if (call.state.endedAt) {
      setShow("ended");
    } else {
      setShow("lobby");
      toast.error("You lost connection to the call. Join again to continue.");
    }
    call.leave().catch((err) => console.error("Failed to leave call", err));
  }, [call, callingState, show]);

  const handleJoin = async () => {
    if (!call) return;

    try {
      await call.join();
      setShow("call");
    } catch (err) {
      console.error("Failed to join call", err);
      // Stream refuses to re-join an ended call, so a refresh can land here.
      await call.get().catch(() => undefined);
      if (call.state.endedAt) {
        setShow("ended");
      } else {
        toast.error("Could not join the call. Please try again.");
      }
    }
  };

  const handleLeave = () => {
    if (!call) return;

    // Anyone else only leaves: the call belongs to the meeting owner.
    if (isOwner) call.endCall();
    setShow("ended");
  };

  return (
    <StreamTheme className="h-[95%]">
      {view === "lobby" && <CallLobby onJoin={handleJoin} />}
      {view === "call" && (
        <CallActive
          onLeave={handleLeave}
          meetingId={meetingId}
          meetingName={meetingName}
        />
      )}
      {view === "ended" && <CallEnded />}
    </StreamTheme>
  );
};
