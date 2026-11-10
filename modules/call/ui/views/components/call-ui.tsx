import { useEffect, useState } from "react";
// The app mounts the use-toast Toaster (components/utils/Providers), not sonner.
import { toast } from "@/lib/hooks/use-toast";
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
  const [isJoining, setIsJoining] = useState(false);
  const [joinFailed, setJoinFailed] = useState(false);
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
      toast({
        title: "You lost connection to the call",
        description: "Join again to continue.",
        variant: "destructive",
      });
    }
    call.leave().catch((err) => console.error("Failed to leave call", err));
  }, [call, callingState, show]);

  const handleJoin = async () => {
    if (!call) return;

    setIsJoining(true);
    setJoinFailed(false);
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
        setJoinFailed(true);
      }
    } finally {
      setIsJoining(false);
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
      {view === "lobby" && (
        <CallLobby onJoin={handleJoin} isJoining={isJoining} joinFailed={joinFailed} />
      )}
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
