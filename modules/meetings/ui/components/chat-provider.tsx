"use client";

import { supabase } from "@/lib/supabase";
import { LoadingState } from "@/components/loading-state";
import { ChatUI } from "./chat-ui";
import { useEffect, useState } from "react";

interface Props {
    meetingId: string;
    meetingName: string;
};

export const ChatProvider = ({ meetingId, meetingName }: Props) => {
    const [session, setSession] = useState<any | null>(null);
    const [isPending, setIsPending] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            setSession(data?.session ?? null);
            setIsPending(false);
        };
        fetchSession();
        return () => {
            mounted = false;
        };
    }, []);

    if (isPending || !session?.user) {
        return (
            <LoadingState
                title="Loading..."
                description="Please wait while we load the chat"
            />
        );
    }

    const user = session.user;
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
    const userImage = user?.user_metadata?.avatar_url || user?.avatar_url || "";

    return (
        <ChatUI
            meetingId={meetingId}
            meetingName={meetingName}
            userId={user.id}
            userName={userName}
            userImage={userImage}
        />
    )
}