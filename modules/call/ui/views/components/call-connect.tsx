"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
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
            tokenProvider: generateToken,
        });

        setClient(_client);

        return () => {
            _client.disconnectUser();
            setClient(undefined);
        };
    }, [userId, userName, userImage, generateToken]);

    const [call, setCall] = useState<Call>();
    const [isEnsuring, setIsEnsuring] = useState(false);

    useEffect(() => {
        if (!client) return;

        const setupCall = async () => {
            try {
                setIsEnsuring(true);
                // Ensure the Stream.io call exists before trying to join
                await ensureCallExists({ id: meetingId });

                const _call = client.call("default", meetingId);
                _call.camera.disable();
                _call.microphone.disable();
                setCall(_call);
            } finally {
                setIsEnsuring(false);
            }
        };

        setupCall();

        return () => {
            if (call && call.state.callingState !== CallingState.LEFT) {
                call.leave();
                call.endCall();
                setCall(undefined);
            };
        };
    }, [client, meetingId, ensureCallExists]);

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
