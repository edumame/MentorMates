import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { DashBoardStats } from "./components/DashBoardStats";
import { NavigateMM } from "./components/NavigateMM";
import { MyEvents } from "./components/MyEvents";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

interface Stats {
  events: number;
  projects: number;
  feedback: number;
}

export function AuthHero() {
  
  const [userName, setUserName] = useState<string>("MentorMate");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient();

        // Get user session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch user profile (assuming 'profiles' table with 'full_name' or 'username')
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("display_name, email")
            .eq("uid", session.user.id)
            .single();

          const full =
            profile?.display_name ||
            profile?.email?.split("@")[0] ||
            "MentorMate";
          const first = full.trim().split(/\s+/)[0];
          setUserName(first);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchUser();
  }, []);

  return (
    <PageContainer className="rounded-tl-2xl sm:rounded-tl-2xl rounded-none sm:border-t sm:border-l">
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col items-start gap-[24px] px-[32px]">
          <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">Welcome, {userName}!</h1>

          <DashBoardStats />
          <NavigateMM />
          <MyEvents />
        </div>
      </PageContent>
    </PageContainer>
  );
}
