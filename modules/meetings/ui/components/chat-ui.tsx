import { useState, useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Channel as StreamChannel } from "stream-chat";
import { useCreateChatClient } from "stream-chat-react";
import { Mic, Plus, SendHorizontal } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";

interface ChatUIProps {
    meetingId: string;
    meetingName: string;
    userId: string;
    userName: string;
    userImage: string | undefined;
};

type ChatMessage = StreamChannel["state"]["messages"][number];

const MAX_COMPOSER_HEIGHT = 180;

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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [isChannelLoading, setIsChannelLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);

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
        let subscription: { unsubscribe?: () => void } | null = null;

        const syncMessages = () => {
            if (!mounted) return;
            setMessages([...(nextChannel.state.messages ?? [])]);
        };

        const initializeChannel = async () => {
            try {
                await nextChannel.watch();
                if (!mounted) return;

                syncMessages();
                setIsChannelLoading(false);

                subscription = nextChannel.on((event) => {
                    if (!event.type.startsWith("message.")) return;
                    syncMessages();
                }) as { unsubscribe?: () => void };
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
            subscription?.unsubscribe?.();
            void nextChannel.stopWatching?.();
        };
    }, [client, meetingId, userId]);

    const resizeComposer = (textarea: HTMLTextAreaElement) => {
        textarea.style.height = "0px";
        const nextHeight = Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT);
        textarea.style.height = `${Math.max(nextHeight, 28)}px`;
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    useEffect(() => {
        if (!composerRef.current) return;
        resizeComposer(composerRef.current);
    }, [draft]);

    const handleSend = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!channel || isSending) return;

        const trimmedDraft = draft.trim();
        if (!trimmedDraft) return;

        setDraft("");
        setChatError(null);
        setIsSending(true);

        try {
            await channel.sendMessage({ text: trimmedDraft });
            setMessages([...(channel.state.messages ?? [])]);
        } catch (error) {
            console.error("Failed to send message", error);
            setDraft(trimmedDraft);
            setChatError("Message failed to send. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
    };

    if (!client || isChannelLoading) {
        return (
            <LoadingState
                title="Loading Chat"
                description="This may take a few seconds"
            />
        );
    }

    const hasMessages = messages.length > 0;

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#F4F4F5]">
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-8">
                {!hasMessages ? (
                    <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center pb-20 text-center">
                        <h2 className="text-[38px] font-medium tracking-[-0.03em] text-[#0E1013] sm:text-[56px]">
                            What can I help with?
                        </h2>
                        <p className="mt-4 text-[16px] text-[#6C7077]">
                            Ask anything about {meetingName}.
                        </p>
                    </div>
                ) : (
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-4">
                        {messages.map((message, index) => {
                            const text = message.text?.trim();
                            if (!text) return null;

                            const isCurrentUser = message.user?.id === userId;
                            const messageKey = message.id || `${message.created_at || "message"}-${index}`;

                            return (
                                <div
                                    key={messageKey}
                                    className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`${
                                            isCurrentUser
                                                ? "max-w-[82%] rounded-full bg-[#DDEEFF] px-5 py-3 text-[#153A62]"
                                                : "max-w-[82%] text-[#111317]"
                                        } text-[17px] leading-[1.55] whitespace-pre-wrap`}
                                    >
                                        {text}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} className="h-px w-full" />
                    </div>
                )}
            </div>

            <div className="px-4 pb-6 pt-2 sm:px-8">
                <div className="mx-auto w-full max-w-5xl">
                    {chatError ? (
                        <p className="mb-3 text-sm text-red-600">{chatError}</p>
                    ) : null}

                    <form
                        onSubmit={handleSend}
                        className="flex items-end gap-3 rounded-[34px] border border-[#CDD2D9] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                    >
                        <button
                            type="button"
                            aria-label="Attach file"
                            disabled
                            className="flex h-10 w-10 items-center justify-center rounded-full text-[#1F2328] transition hover:bg-[#F1F2F4] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Plus className="h-6 w-6" />
                        </button>

                        <textarea
                            ref={composerRef}
                            rows={1}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={handleComposerKeyDown}
                            placeholder="Ask anything"
                            className="max-h-[180px] min-h-[28px] flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[17px] leading-[1.4] text-[#111317] outline-none placeholder:text-[#8B8F96]"
                        />

                        <button
                            type="button"
                            aria-label="Voice input"
                            disabled
                            className="flex h-10 w-10 items-center justify-center rounded-full text-[#1F2328] transition hover:bg-[#F1F2F4] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Mic className="h-6 w-6" />
                        </button>

                        <button
                            type="submit"
                            aria-label="Send message"
                            disabled={!channel || !draft.trim() || isSending}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1987FF] text-white transition hover:bg-[#1475de] disabled:cursor-not-allowed disabled:bg-[#A9C7EA]"
                        >
                            <SendHorizontal className="h-5 w-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
};
