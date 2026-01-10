"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, Close, NotificationsNone } from "@mui/icons-material";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdmin } from "@/lib/hooks/use-admin";
import posthog from "posthog-js";
import { UserProfile } from "@/lib/types";
import { GraduationCap } from "lucide-react";

interface ExtendedUserProfile extends UserProfile {
  onboarding_metadata: object;
  affiliation: string | null;
}

export function AuthNavbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isAdmin = useAdmin();
  const [userProfile, setUserProfile] = useState<ExtendedUserProfile | null>(
    null
  );

  // fetch & subscribe to session
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: userProfileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("uid", session?.user?.id)
        .single();
      setUserProfile(userProfileData);
    };
    if (session) {
      fetchUserProfile();
    }
  }, [session]);

  const handleLogin = () => {
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname;
      if (returnUrl !== "/mentor") localStorage.setItem("returnUrl", returnUrl);
    }
    router.push("/login");
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("returnUrl");
    await supabase.auth.signOut();
    posthog.reset();
    router.push("/");
    window.location.reload();
    setIsOpen(false);
  };

  return (
    <>
      <nav className="fixed inset-x-0 z-50 bg-[#fbfcfe] top-[var(--banner-h,0px)]">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/mentormate.png"
              alt="Logo"
              width={200}
              height={40}
              className="object-contain pl-2"
            />
          </Link>

          {/* Desktop Right Controls: notifications (popover) + avatar */}
          <div className="hidden lg:flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Notifications"
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-800 relative"
                >
                  <NotificationsNone className="h-6 w-6" />
                  {/* Show badge if profile incomplete */}
                  {userProfile && !userProfile.affiliation && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[420px] p-0 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl"
              >
                {/* Header with Title and Badge */}
                <div className="p-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.5px] text-black">
                      Notification
                    </h3>
                    <div className="border border-[rgba(0,0,0,0.15)] border-solid rounded-[50px] px-2 py-0">
                      <p className="text-[14px] font-normal leading-[1.5] text-black">
                        {userProfile && !userProfile.affiliation ? "1" : "0"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Completion Notification */}
                {userProfile && !userProfile.affiliation ? (
                  <div className="px-4 pb-4">
                    <Link
                      href={`/profile/${session?.user?.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-zinc-900">
                          Complete your profile
                        </p>
                        <p className="text-[14px] text-zinc-500 mt-0.5">
                          Add your school or company to help others connect with you.
                        </p>
                      </div>
                    </Link>
                  </div>
                ) : (
                  /* Empty State - No Notifications */
                  <div className="px-4 pb-4">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <NotificationsNone className="h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-[16px] font-medium text-zinc-900 mb-1">
                        No notifications
                      </p>
                      <p className="text-[14px] text-zinc-500">
                        You&apos;re all caught up!
                      </p>
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.user_metadata?.avatar_url}
                      />
                      <AvatarFallback>
                        {session.user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-3">
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

                    {!userProfile?.onboarding_metadata ? (
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
                    <DropdownMenuItem onClick={() => router.push("/help")}>
                      Support
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/blog")}>
                      Blog
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Log out
                    </DropdownMenuItem>
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

          {/* Mobile Menu Button */}
          <button
            aria-label="Toggle menu"
            onClick={() => setIsOpen((o) => !o)}
            className="p-2 rounded-md hover:bg-gray-200 flex lg:hidden"
          >
            {isOpen ? (
              <Close className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu (<lg only) - Dropdown style */}
      {isOpen && (
        <div className="fixed inset-0 top-[72px] bg-white z-40 lg:hidden overflow-y-auto">
          <div className="px-6 py-6 space-y-1">
            {/* Navigation Links */}
            <Link
              href="/"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/events"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Events
            </Link>
            <Link
              href="/learn"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Learn
            </Link>
            <Link
              href="/projects"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Projects
            </Link>
            <Link
              href="/feedback"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Feedback
            </Link>

            {/* Divider */}
            <div className="border-t border-gray-200 my-4"></div>

            {/* Additional Links */}
            <Link
              href={`/profile/${session?.user.id}`}
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </Link>
            <Link
              href="/resources"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Resources
            </Link>
            <Link
              href="/help"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
              onClick={() => setIsOpen(false)}
            >
              Support
            </Link>

            {/* Mobile Auth Section */}
            <div className="pt-8 space-y-4 border-t border-gray-200 mt-4">
              {session && (
                <>
                  <div className="flex items-center gap-3 px-2 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.user_metadata?.avatar_url}
                      />
                      <AvatarFallback>
                        {session.user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-center text-base font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
