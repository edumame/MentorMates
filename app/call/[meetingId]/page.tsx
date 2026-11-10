import { createSupabaseClient } from "@/app/utils/supabase/server";
import { CallView } from "@/modules/call/ui/views/call-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginRedirectFor } from "@/modules/meetings/server/login-redirect";
import { MeetingServiceUnavailable } from "@/modules/meetings/ui/views/meeting-id-view";
import { isStreamVideoConfigured } from "@/lib/stream-config";

interface Props {
    params: Promise<{ meetingId: string }>;
};

const Page = async ({ params }: Props) => {
    const { meetingId } = await params;
    
    const supabase = await createSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect(loginRedirectFor(`/call/${meetingId}`));
    }

    // Without Stream keys the call client can never connect; say so instead
    // of spinning on a token request that cannot succeed.
    if (!isStreamVideoConfigured()) {
        return <MeetingServiceUnavailable service="video" />;
    }

    const queryClient = getQueryClient();
    void queryClient.prefetchQuery(
        trpc.meetings.getOne.queryOptions({ id: meetingId }),
    );

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <CallView meetingId={meetingId} />
        </HydrationBoundary>
    );
};

export default Page;