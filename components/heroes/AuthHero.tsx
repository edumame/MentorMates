import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { DashBoardStats } from "./components/DashBoardStats";
import { NavigateMM } from "./components/NavigateMM";
import { MyEvents } from "./components/MyEvents";

export function AuthHero() {
  
  const [userName, setUserName] = useState<string>("MentorMate");
  const [showNavigateMM, setShowNavigateMM] = useState(true);

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

  useEffect(() => {
    // Persist "dismissed" state so the card doesn't re-appear after refresh.
    try {
      const dismissed = window.localStorage.getItem("mentorMates:navigateMMDismissed");
      setShowNavigateMM(dismissed !== "true");
    } catch {
      // If storage is blocked/unavailable, just show the card.
      setShowNavigateMM(true);
    }
  }, []);

  const handleCloseNavigateMM = () => {
    setShowNavigateMM(false);
    try {
      window.localStorage.setItem("mentorMates:navigateMMDismissed", "true");
    } catch {
      // Ignore write failures (private mode, blocked storage, etc.)
    }
  };

  return (
    <div className="pt-[24px] pb-8">
      <div className="flex flex-col items-start gap-[24px] px-[32px]">
          <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">Welcome, {userName}!</h1>

          <DashBoardStats />
          {showNavigateMM ? <NavigateMM onClose={handleCloseNavigateMM} /> : null}
          <MyEvents />
        </div>
    </div>
  );
}
