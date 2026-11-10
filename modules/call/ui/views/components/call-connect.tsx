"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import {
    Call,
    CallingState,
    StreamCall,
    StreamVideo,
    StreamVideoClient,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
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

    const [client, setClient] = useState<StreamVideoClient>();
    useEffect(() => {
        const _client = new StreamVideoClient({
            apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
            user: {
                id: userId,
                name: userName,
                image: userImage,
            },
            tokenProvider: () => generateToken({ id: meetingId }),
        });

        setClient(_client);

        return () => {
            _client.disconnectUser();
            setClient(undefined);
        };
    }, [userId, userName, userImage, generateToken, meetingId]);

    const [call, setCall] = useState<Call>();
    const [isEnsuring, setIsEnsuring] = useState(false);
    const [setupFailed, setSetupFailed] = useState(false);
    const [setupAttempt, setSetupAttempt] = useState(0);

    useEffect(() => {
        if (!client) return;

        let isCurrentAttempt = true;

        const setupCall = async () => {
            try {
                setIsEnsuring(true);
                setSetupFailed(false);
                // Ensure the Stream.io call exists before trying to join
                await ensureCallExists({ id: meetingId });

                const _call = client.call("default", meetingId);
                _call.camera.disable();
                _call.microphone.disable();
                setCall(_call);
            } catch (error) {
                console.error("Failed to set up call", error);
                if (isCurrentAttempt) setSetupFailed(true);
            } finally {
                setIsEnsuring(false);
            }
        };

        setupCall();

        return () => {
            isCurrentAttempt = false;
            if (call && call.state.callingState !== CallingState.LEFT) {
                call.leave();
                call.endCall();
                setCall(undefined);
            };
        };
    }, [client, meetingId, ensureCallExists, setupAttempt]);

    if (setupFailed) {
        return (
            <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
                <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg p-10 shadow-sm">
                    <div role="alert" className="flex flex-col gap-y-2 text-center">
                        <h6 className="text-lg font-medium">We couldn&apos;t set up this call</h6>
                        <p className="text-sm">Please try again, or head back and rejoin later.</p>
                    </div>
                    <div className="flex gap-x-2 justify-between w-full">
                        <Button asChild variant="ghost">
                            <Link href="/learn">Back to Learn section</Link>
                        </Button>
                        <Button onClick={() => setSetupAttempt((attempt) => attempt + 1)}>
                            Try again
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    if (!client || !call || isEnsuring) {
        return (
            <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
                <LoaderIcon className="size-6 animate-spin text-white" />
            </div>
        );
    };

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <CallUI meetingId={meetingId} meetingName={meetingName} />
            </StreamCall>
        </StreamVideo>
    )
};
