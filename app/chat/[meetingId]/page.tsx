import { createSupabaseClient } from "@/app/utils/supabase/server";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { MeetingChatView, MeetingIdViewError, MeetingIdViewLoading } from "@/modules/meetings/ui/views/meeting-id-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface Props {
  params: Promise<{ meetingId: string }>;
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
  void queryClient.prefetchQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  return (
    <PageContainer>
          <PageContent className="pt-[24px] pb-8">
            <div className="flex flex-col gap-[24px] px-[32px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[8px]">
                  <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                    Chat with agent
                  </h1>
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