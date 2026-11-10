"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CallProvider } from "./components/call-provider";

interface Props {
    meetingId: string;
};

export const CallView = ({ meetingId }: Props) => {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

    const { name, user_id } = data as { name: string; user_id: string | null };

    return <CallProvider meetingId={meetingId} meetingName={name} meetingOwnerId={user_id} />
};