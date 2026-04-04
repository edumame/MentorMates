"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdmin } from "@/lib/hooks/use-admin";
import { hasCompletedOnboarding } from "@/features/user/onboarding/metadata";
import posthog from "posthog-js";
import { UserProfile } from "@/lib/types";

interface ExtendedUserProfile extends UserProfile {
  onboarding_metadata: Record<string, unknown> | null;
  affiliation: string | null;
  phone_number?: string | null;
  links?: Record<string, string> | null;
}

interface AuthNavbarRightProps {
  className?: string;
}

export function AuthNavbarRight({ className }: AuthNavbarRightProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const isAdmin = useAdmin();
  const [userProfile, setUserProfile] = useState<ExtendedUserProfile | null>(
    null
  );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("uid", session?.user?.id)
        .single();
      setUserProfile(data);
    };
    if (session) fetchUserProfile();
  }, [session]);

  const handleLogin = () => {
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname;
      if (returnUrl !== "/mentor") localStorage.setItem("returnUrl", returnUrl);
    }
    router.push("/login");
  };

  const handleSignOut = async () => {
    localStorage.removeItem("returnUrl");
    await supabase.auth.signOut();
    posthog.reset();
    router.push("/");
    window.location.reload();
  };

  return (
    <div className={className}>
      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Account menu">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user.user_metadata?.avatar_url} />
              <AvatarFallback>
                {session.user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="p-3">
              <div className="px-2 pb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold leading-tight">
                    {session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      session.user.email?.split("@")[0]}
                  </p>
                  {isAdmin && (
                    <span className="text-sm rounded-full bg-blue-100 text-blue-700 px-3 py-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-base text-gray-700 mt-1">
                  {session.user.email}
                </p>
                {!hasCompletedOnboarding(userProfile?.onboarding_metadata) ? (
                  <Button
                    variant="defaultGray"
                    onClick={() => router.push("/onboarding")}
                    className="mt-4 w-full text-base"
                  >
                    Set up profile
                  </Button>
                ) : (
                  <Button
                    variant="defaultGray"
                    onClick={() =>
                      router.push(`/profile/${session?.user?.id}`)
                    }
                    className="mt-4 w-full text-base"
                  >
                    View profile
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuItem onSelect={() => router.push("/help")}>
                  Support
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/blog")}>
                  Blog
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void handleSignOut()}
                  className="text-red-600 hover:bg-red-50"
                >
                  Log out
                </DropdownMenuItem>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={handleLogin}
          aria-label="Log in"
          className="rounded-full focus:outline-none"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </button>
      )}
    </div>
  );
}
