"use client"

import type { Session } from "@supabase/supabase-js";
import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CallConnect } from "./call-connect";

interface Props {
    meetingId: string;
    meetingName: string;
};

export const CallProvider = ({ meetingId, meetingName }: Props) => {
    const [session, setSession] = useState<Session | null>(null);
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

    if (!session || isPending) {
        return (
            <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
                <LoaderIcon className="size-6 animate-spin text-white" />
            </div>
        );
    }

    const user = session.user;
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
    const userImage = user?.user_metadata?.avatar_url;

    return (
        <CallConnect
            meetingId={meetingId}
            meetingName={meetingName}
            userId={user.id}
            userName={userName}
            userImage={userImage}
        />
    );
};
