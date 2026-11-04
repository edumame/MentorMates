"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import {
    Call,
    StreamCall,
    StreamVideo,
    StreamVideoClient,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { ErrorState } from "@/components/error-state";
import { CallUI } from "./call-ui";

interface Props {
    meetingId: string;
    meetingName: string;
    userId: string;
    userName: string;
    userImage: string;
};

export const CallConnect = ({
    meetingId,
    meetingName,
    userId,
    userName,
    userImage,
}: Props) => {
    const trpc = useTRPC();
    const { mutateAsync: generateToken } = useMutation(trpc.meetings.generateToken.mutationOptions());
    const { mutateAsync: ensureCallExists } = useMutation(trpc.meetings.ensureCallExists.mutationOptions());

    const identity = JSON.stringify([meetingId, userId]);
    const [connection, setConnection] = useState<{ identity: string; client: StreamVideoClient; call: Call }>();
    const [failure, setFailure] = useState<{ identity: string }>();

    useEffect(() => {
        let active = true;
        let nextClient: StreamVideoClient | undefined;
        let nextCall: Call | undefined;
        let disposed = false;
        const dispose = async () => {
            if (disposed) return;
            disposed = true;
            try { await nextCall?.leave(); } catch { /* Already disconnected. */ }
            try { await nextClient?.disconnectUser(); } catch { /* Cleanup is best effort. */ }
        };
        setConnection(undefined);
        setFailure(undefined);
        const tokenProvider = async () => {
            if (!active || disposed) throw new Error("Connection closed");
            try {
                const token = await generateToken({ id: meetingId });
                if (!active || disposed) throw new Error("Connection closed");
                return token;
            } catch {
                if (active) setFailure({ identity });
                void pending.then(dispose);
                throw new Error("Unable to authorize this call");
            }
        };
        const setup = async () => {
            try {
                await ensureCallExists({ id: meetingId });
                if (!active) return;
                // Explicit connection lets us handle token errors instead of the
                // SDK constructor's fire-and-forget connection path.
                nextClient = new StreamVideoClient(process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!);
                await nextClient.connectUser({ id: userId, name: userName, image: userImage }, tokenProvider);
                if (!active) return;
                nextCall = nextClient.call("default", meetingId);
                await Promise.all([nextCall.camera.disable(), nextCall.microphone.disable()]);
                if (active) setConnection({ identity, client: nextClient, call: nextCall });
            } catch {
                if (active) setFailure({ identity });
                await dispose();
            }
        };
        const pending = setup();
        return () => {
            active = false;
            // Wait for setup to settle before disconnecting its exact resources.
            // Leaving a page must never end the meeting for other participants.
            void pending.then(dispose);
        };
    }, [identity, meetingId, userId, userName, userImage, generateToken, ensureCallExists]);

    if (failure?.identity === identity) {
        return <ErrorState title="Unable to join call" description="Please refresh and try again, or check your access to this meeting." />;
    }
    if (connection?.identity !== identity) {
        return (
            <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
                <LoaderIcon className="size-6 animate-spin text-white" />
            </div>
        );
    }
    const { client, call } = connection;

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <CallUI meetingId={meetingId} meetingName={meetingName} />
            </StreamCall>
        </StreamVideo>
    )
};
