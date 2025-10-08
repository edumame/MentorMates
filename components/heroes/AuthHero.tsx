import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { DashBoardStats } from "./components/DashBoardStats";
import { NavigateMM } from "./components/NavigateMM";
import { MyEvents } from "./components/MyEvents";

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
    <div className="flex flex-col items-start gap-12 flex-1 border-t border-l border-[#D8D8D8] bg-white [background:linear-gradient(203deg,rgba(219,234,254,0.25)_13.19%,rgba(255,255,255,0.00)_65.83%),#FFF] px-8 py-6 min-h-screen rounded-tl-2xl sm:rounded-tl-2xl rounded-none sm:border-t sm:border-l">
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold">Welcome, {userName}!</h1>
      </div>

      <DashBoardStats />
      <NavigateMM />
      <MyEvents />
    </div>
  );
}
