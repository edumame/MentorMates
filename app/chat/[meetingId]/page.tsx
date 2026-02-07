import { createSupabaseClient } from "@/app/utils/supabase/server";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MeetingChatView, MeetingIdViewError, MeetingIdViewLoading } from "@/modules/meetings/ui/views/meeting-id-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import SubmitTranscriptButton from "@/components/SubmitTranscriptButton";

interface Props {
  params: Promise<{ meetingId: string }>;
}

interface MeetingHeaderData {
  agent?: {
    name?: string | null;
    avatar_url?: string | null;
  } | null;
}

const Page = async ({ params }: Props) => {
  const { meetingId } = await params;
      
  const supabase = await createSupabaseClient();
  const {
      data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  };

  const queryClient = getQueryClient();
  const meetingQueryOptions = trpc.meetings.getOne.queryOptions({ id: meetingId });
  await queryClient.prefetchQuery(meetingQueryOptions);

  const meetingData = queryClient.getQueryData(meetingQueryOptions.queryKey) as MeetingHeaderData | undefined;
  const agentName = meetingData?.agent?.name?.trim() || "agent";
  const agentAvatarUrl = meetingData?.agent?.avatar_url ?? "";
  const agentFallback = agentName.charAt(0).toUpperCase();

  return (
    <PageContainer>
          <PageContent className="pt-[24px] pb-8">
            <div className="flex flex-col gap-[24px] px-[32px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[12px]">
                  <Avatar className="h-11 w-11 border border-[#E4E7EC]">
                    <AvatarImage src={agentAvatarUrl} alt={agentName} />
                    <AvatarFallback className="bg-[#EAF2FF] text-[#2F61B3] font-semibold">
                      {agentFallback}
                    </AvatarFallback>
                  </Avatar>
                  <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                    Chat with {agentName}
                  </h1>
                </div>
                <div>
                  {/* Client component handles calling the submit endpoint */}
                  <Suspense>
                    <SubmitTranscriptButton meetingId={meetingId} />
                  </Suspense>
                </div>
              </div>
              <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MeetingIdViewLoading />}>
                  <ErrorBoundary fallback={<MeetingIdViewError />}>
                    <MeetingChatView meetingId={meetingId} />
                  </ErrorBoundary>
                </Suspense>
              </HydrationBoundary>
            </div>
        </PageContent>
    </PageContainer>
  )
}

export default Page;
