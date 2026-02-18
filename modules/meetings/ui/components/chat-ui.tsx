import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Channel as StreamChannel } from "stream-chat";
import {
    Chat,
    Channel,
    MessageInput,
    MessageList,
    Thread,
    Window,
    useCreateChatClient,
} from "stream-chat-react";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatUIProps {
    meetingId: string;
    meetingName: string;
    userId: string;
    userName: string;
    userImage: string | undefined;
};

const ChatEmptyState = ({ meetingName }: { meetingName: string }) => (
    <div className="mx-auto flex min-h-[56vh] w-full max-w-5xl flex-col items-center justify-center pb-20 text-center">
        <h2 className="text-[38px] font-medium tracking-[-0.03em] text-[#0E1013] sm:text-[56px]">
            What can I help with?
        </h2>
        <p className="mt-4 text-[16px] text-[#6C7077]">
            Ask anything about {meetingName}.
        </p>
    </div>
);

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
    const [isChannelLoading, setIsChannelLoading] = useState(true);
    const [chatError, setChatError] = useState<string | null>(null);

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

        const nextChannel = client.channel("messaging", meetingId, { members: [userId] });
        setChannel(nextChannel);
        setIsChannelLoading(true);
        setChatError(null);

        let mounted = true;

        const initializeChannel = async () => {
            try {
                await nextChannel.watch();
                if (!mounted) return;

                setIsChannelLoading(false);
            } catch (error) {
                console.error("Failed to initialize chat channel", error);
                if (!mounted) return;
                setChannel(undefined);
                setIsChannelLoading(false);
                setChatError("Unable to load this chat right now. Please refresh and try again.");
            }
        };

        void initializeChannel();

        return () => {
            mounted = false;
            void nextChannel.stopWatching?.();
        };
    }, [client, meetingId, userId]);

    if (!client || isChannelLoading) {
        return (
            <LoadingState
                title="Loading Chat"
                description="This may take a few seconds"
            />
        );
    }

    if (chatError || !channel) {
        return (
            <ErrorState
                title="Unable to load chat"
                description={chatError ?? "Please refresh and try again."}
            />
        );
    }

    return (
        <div className="chatgpt-stream-shell flex h-full min-h-0 flex-col bg-[#F4F4F5]">
            <Chat client={client}>
                <Channel
                    channel={channel}
                    EmptyStateIndicator={() => <ChatEmptyState meetingName={meetingName} />}
                >
                    <Window>
                        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-8">
                            <div className="mx-auto w-full max-w-5xl">
                                <MessageList />
                            </div>
                        </div>

                        <div className="px-4 pb-6 pt-2 sm:px-8">
                            <div className="mx-auto w-full max-w-5xl">
                                {/* TODO: Add voice input once transcription support is implemented. */}
                                <MessageInput additionalTextareaProps={{ placeholder: "Ask anything" }} />
                            </div>
                        </div>
                    </Window>
                    <Thread />
                </Channel>
            </Chat>
        </div>
    )
};
