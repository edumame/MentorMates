"use client"

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CompletedState } from "../components/completed-state";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { ChatProvider } from "../components/chat-provider";
import { MeetingGetOne } from "../../types";

interface Props {
    meetingId: string;
};

export const MeetingIdView = ({ meetingId }: Props) => {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

    return (
        <CompletedState data={data} />            
    )
};

export const MeetingChatView = ({ meetingId }: Props) => {
    const trpc = useTRPC();
    const { data }: MeetingGetOne = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));
    
    return (
        <ChatProvider meetingId={data.id} meetingName={data.name} projectName={data.projectName} />          
    )
};

export const MeetingIdViewLoading = () => {
    return (
        <LoadingState title="Loading Meeting" description="This may take a few seconds" />
    )
}

/** Shown when the Stream video/chat provider is not configured for this deployment. */
export const MeetingServiceUnavailable = ({ service }: { service: "video" | "chat" }) => {
    return (
        <ErrorState
            title={service === "video" ? "Video calls are unavailable" : "Chat is unavailable"}
            description={`${service === "video" ? "Video calls are" : "Meeting chat is"} not set up for this MentorMates deployment yet. Please contact the event organizer.`}
        />
    )
}

export const MeetingIdViewError = () => {
    return (
        <ErrorState title="Error Loading Meeting" description="Please try again later" />
    )
}
