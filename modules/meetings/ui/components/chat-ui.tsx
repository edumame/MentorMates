import { useState, useEffect, useRef } from "react";
import type { WheelEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Channel as StreamChannel } from "stream-chat";
import {
    useCreateChatClient,
    Chat,
    Channel,
    MessageInput,
    MessageList,
    Thread,
    Window,
} from "stream-chat-react";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatUIProps {
    meetingId: string;
    meetingName: string;
    userId: string;
    userName: string;
    userImage: string | undefined;
};

export const ChatUI = ({
    meetingId,
    meetingName,
    userId,
    userName,
    userImage,
}: ChatUIProps) => {
    const trpc = useTRPC();
    const { mutateAsync: generateChatToken } = useMutation(trpc.meetings.generateChatToken.mutationOptions());

    const [channel, setChannel] = useState<StreamChannel>();
    const client = useCreateChatClient({
        apiKey: process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
        tokenOrProvider: generateChatToken,
        userData: {
            id: userId,
            name: userName,
            image: userImage,
        },
    });

    useEffect(() => {
        if (!client) return;

        const channel = client.channel("messaging", meetingId, { members: [userId] });

        setChannel(channel);
    }, [client, meetingId, meetingName, userId]);

    const listRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll to bottom when new messages appear, using smooth behavior
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        // Ensure smooth scrolling is enabled
        try {
            el.style.scrollBehavior = "smooth";
        } catch (e) {
            console.error("Failed to enable smooth scrolling", e);
        }

        // Scroll to bottom once on mount
        el.scrollTop = el.scrollHeight;

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length > 0) {
                    // New message(s) added -> scroll to bottom
                    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                    break;
                }
            }
        });

        observer.observe(el, { childList: true, subtree: true });

        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listRef.current]);

    const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
        const el = listRef.current;
        if (!el) return;

        // Apply wheel delta immediately to match native scrollbar speed
        el.scrollTop += e.deltaY;
        e.preventDefault();
    };

    if (!client) {
        return (
            <LoadingState
                title="Loading Chat"
                description="This may take a few seconds"
            />
        );
    }

    return (
        <div className="bg-white rounded-lg border overflow-hidden">
            <Chat client={client}>
                <Channel channel={channel}>
                    <Window>
                        <div
                            ref={listRef}
                            onWheel={handleWheel}
                            className="flex-1 overflow-y-auto max-h-[calc(100vh-23rem)] border-b"
                        >
                            <MessageList />
                        </div>
                        <MessageInput />
                    </Window>
                    <Thread />
                </Channel>
            </Chat>
        </div>
    )
};
