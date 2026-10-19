import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { StreamChat, type Channel as StreamChannel } from "stream-chat";
import {
    Chat,
    Channel,
    MessageInput,
    MessageList,
    Thread,
    Window,
} from "stream-chat-react";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatUIProps {
    meetingId: string;
    meetingName: string;
    projectName?: string | null;
    userId: string;
    userName: string;
    userImage: string | undefined;
};

const ChatEmptyState = ({ contextName }: { contextName: string }) => (
    <div className="mx-auto flex min-h-[56vh] w-full max-w-5xl flex-col items-center justify-center pb-20 text-center">
        <h2 className="text-[38px] font-medium tracking-[-0.03em] text-[#0E1013] sm:text-[56px]">
            What can I help with?
        </h2>
        <p className="mt-4 text-[16px] text-[#6C7077]">
            Ask anything about {contextName}.
        </p>
    </div>
);

export const ChatUI = ({
    meetingId,
    projectName,
    userId,
    userName,
    userImage,
}: ChatUIProps) => {
    const trpc = useTRPC();
    const { mutateAsync: generateChatToken } = useMutation(trpc.meetings.generateChatToken.mutationOptions());

    const identity = JSON.stringify([meetingId, userId]);
    const [connection, setConnection] = useState<{ identity: string; client: StreamChat; channel: StreamChannel }>();
    const [failure, setFailure] = useState<{ identity: string }>();

    useEffect(() => {
        let active = true;
        let nextClient: StreamChat | undefined;
        let nextChannel: StreamChannel | undefined;
        let disposed = false;
        const dispose = async () => {
            if (disposed) return;
            disposed = true;
            try { await nextChannel?.stopWatching(); } catch { /* Already disconnected. */ }
            try { await nextClient?.disconnectUser(); } catch { /* Cleanup is best effort. */ }
        };
        setConnection(undefined);
        setFailure(undefined);
        const tokenProvider = async () => {
            if (!active || disposed) throw new Error("Connection closed");
            try {
                // Each refresh rechecks this meeting and provisions membership
                // server-side before the browser can watch the channel.
                const token = await generateChatToken({ id: meetingId });
                if (!active || disposed) throw new Error("Connection closed");
                return token;
            } catch {
                if (active) setFailure({ identity });
                void pending.then(dispose);
                throw new Error("Unable to authorize this chat");
            }
        };
        const setup = async () => {
            try {
                nextClient = new StreamChat(process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!);
                await nextClient.connectUser({ id: userId, name: userName, image: userImage }, tokenProvider);
                if (!active) return;
                nextChannel = nextClient.channel("messaging", meetingId);
                await nextChannel.watch();
                if (active) setConnection({ identity, client: nextClient, channel: nextChannel });
            } catch {
                if (active) setFailure({ identity });
                await dispose();
            }
        };
        const pending = setup();
        return () => {
            active = false;
            void pending.then(dispose);
        };
    }, [identity, meetingId, userId, userName, userImage, generateChatToken]);

    if (failure?.identity === identity) {
        return <ErrorState title="Unable to load chat" description="Please refresh and try again, or check your access to this meeting." />;
    }
    if (connection?.identity !== identity) {
        return <LoadingState title="Loading Chat" description="This may take a few seconds" />;
    }
    const { client, channel } = connection;

    const emptyStateContextName = projectName?.trim() || "this project";

    return (
        <div className="chatgpt-stream-shell flex h-full min-h-0 flex-col bg-[#F4F4F5]">
            <Chat client={client}>
                <Channel
                    channel={channel}
                    EmptyStateIndicator={() => <ChatEmptyState contextName={emptyStateContextName} />}
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
