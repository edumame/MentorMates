"use client";

import Image from "next/image";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export function Hero() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchUserName = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) {
        console.error("Error fetching session:", error);
        return;
      }
      setUserName(
        session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] ||
          "User"
      );
    };

    fetchUserName();
  }, []);

  return (
    <div className="relative flex flex-col overflow-hidden bg-artistic">
      <div className="flex items-center justify-center px-4 sm:px-6">
        <div className="relative text-center max-w-4xl w-full">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 sm:mb-6 flex items-center justify-center">
            <span className="flex items-center gap-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-blue-300">
              Mentor Mates
            </span>
          </h1>
          <h2 className="text-xl sm:text-2xl text-gray-800 mb-4 sm:mb-6">
            Welcome back, {userName}!
          </h2>
          <TextGenerateEffect
            words="Ready to explore feedback and insights? Let's make learning more meaningful together."
            className="text-base sm:text-lg text-gray-600 mb-8 max-w-3xl mx-auto px-1"
          />
          <div className="mt-24 text-center space-y-4">
            <p className="text-sm text-gray-600 font-medium tracking-wide uppercase">
              Supported by:
            </p>
            <div className="relative w-[160px] h-[80px] sm:w-[200px] sm:h-[100px] mx-auto">
              <Link
                href="https://acceleratelearning.stanford.edu/funding/people-who-help-other-people-learn-pwhopl/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
              >
                <Image
                  src="https://clinicalmindai.stanford.edu/sites/g/files/sbiybj31566/files/styles/responsive_large/public/media/image/motif_text-stanford_accelerator_for_learning_rgb_1_1.png.webp?itok=b--D-kMe"
                  alt="Stanford Accelerator for Learning"
                  fill
                  className="object-contain opacity-90 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                  priority
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
