import { createSupabaseClient } from "@/app/utils/supabase/server";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { MeetingChatView, MeetingIdViewError, MeetingIdViewLoading } from "@/modules/meetings/ui/views/meeting-id-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import SubmitTranscriptButton from "@/components/SubmitTranscriptButton";
import { ChevronDownIcon } from "lucide-react";

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
  const agentName = meetingData?.agent?.name?.trim() || "Assistant";

  return (
    <PageContainer className="bg-[#F4F4F5]">
          <PageContent className="h-full overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between px-5 pb-3 pt-4 sm:px-8">
                <div className="inline-flex items-center gap-1 text-[26px] font-medium tracking-[-0.02em] text-[#1A1D22] sm:text-[32px]">
                  <span>{agentName}</span>
                  <ChevronDownIcon className="h-6 w-6 text-[#5E636B] sm:h-7 sm:w-7" />
                </div>
                <div>
                  <Suspense>
                    <SubmitTranscriptButton meetingId={meetingId} />
                  </Suspense>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <HydrationBoundary state={dehydrate(queryClient)}>
                  <Suspense fallback={<MeetingIdViewLoading />}>
                    <ErrorBoundary fallback={<MeetingIdViewError />}>
                      <MeetingChatView meetingId={meetingId} />
                    </ErrorBoundary>
                  </Suspense>
                </HydrationBoundary>
              </div>
            </div>
        </PageContent>
    </PageContainer>
  )
}

export default Page;
