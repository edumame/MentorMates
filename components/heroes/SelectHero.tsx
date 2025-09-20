"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UserPen, UserCheck } from "lucide-react";

export function SelectHero() {
  const router = useRouter();

  useEffect(() => {
    // Disable scrolling when the component mounts
    document.body.style.overflow = "hidden";
    // Clean up by resetting overflow when the component unmounts
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleParticipantClick = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error("Error checking session:", error);
      return;
    }
    if (!session) {
      router.push("/login");
    } else {
      router.push("/projects");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-artistic py-2 overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 text-center">
        <h1 className="text-4xl font-bold text-blue-900 font-geist tracking-[-0.06em]">
          Choose Your Role
        </h1>
        <div className="space-y-4">
          <p className="text-xl text-gray-700 mb-8">
            Are you participating in the event or helping to mentor and judge?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleParticipantClick}
              className="bg-blue-900 text-white px-8 py-6 text-lg"
            >
              <UserPen className="mr-2" /> Participant
            </Button>
            <Button
              variant="outline"
              className="px-8 py-6 text-lg"
              onClick={() => {
                router.push("/mentor/login");
              }}
            >
              <UserCheck className="mr-2" /> Mentor/ Judge
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
