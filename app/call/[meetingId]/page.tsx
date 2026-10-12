import { createSupabaseClient } from "@/app/utils/supabase/server";
import { CallView } from "@/modules/call/ui/views/call-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
        redirect("/sign-in");
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