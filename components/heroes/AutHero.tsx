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
    const [loadingStats, setLoadingStats] = useState<boolean>(true);
    const [stats, setStats] = useState<Stats>({
        events: 0,
        projects: 0,
        feedback: 0,
    });
    const [userName, setUserName] = useState<string>("MentorMate");

    useEffect(() => {
        const fetchStatsAndUser = async () => {
            setLoadingStats(true);
            try {
                const supabase = createClient();

                // Get user session
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (session?.user) {
                    // Fetch user profile (assuming 'profiles' table with 'full_name' or 'username')
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("full_name, username")
                        .eq("id", session.user.id)
                        .single();

                    const full =
                        profile?.full_name ||
                        profile?.username ||
                        session.user.email?.split("@")[0] ||
                        "MentorMate";
                    const first = full.trim().split(/\s+/)[0];
                    setUserName(first);
                }

                // Fetch stats (replace with actual table names and logic)
                const [
                    { count: eventsCount },
                    { count: projectsCount },
                    { count: feedbackCount },
                ] = await Promise.all([
                    supabase.from("events").select("*", { count: "exact", head: true }),
                    supabase.from("projects").select("*", { count: "exact", head: true }),
                    supabase.from("feedback").select("*", { count: "exact", head: true }),
                ]);

                setStats({
                    events: eventsCount ?? 0,
                    projects: projectsCount ?? 0,
                    feedback: feedbackCount ?? 0,
                });
            } catch (error) {
                // Optionally log error
                setStats({ events: 0, projects: 0, feedback: 0 });
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStatsAndUser();
    }, []);

    return (
        <div
            className="
                flex flex-col items-start gap-12 flex-1
                rounded-tl-2xl
                border-t border-l border-[#D8D8D8]
                bg-white
                [background:linear-gradient(203deg,rgba(219,234,254,0.25)_13.19%,rgba(255,255,255,0.00)_65.83%),#FFF]
                px-8 py-6
                min-h-screen
            "
            style={{ minHeight: "100vh" }}
        >
            <div className="flex flex-col items-start gap-4">
                <h1 className="text-2xl font-semibold">Welcome, {userName}!</h1>
            </div>

            <DashBoardStats />
            <NavigateMM />
            <MyEvents />
        </div>
    );
}
