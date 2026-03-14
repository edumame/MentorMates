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
import { AuthNavbarRight } from "./AuthNavbarRight";

interface ExtendedUserProfile extends UserProfile {
  // Onboarding data is stored as JSON in the database.
  // We keep it flexible here because different onboarding versions can add fields over time.
  onboarding_metadata: Record<string, unknown> | null;

  // The user's school/university/company.
  affiliation: string | null;

  // Stored as text because phone numbers vary by country/format.
  // We do NOT display it here (sensitive), only use it to decide if the profile is complete.
  phone_number?: string | null;

  // Social links are stored as JSON on `user_profiles.links`.
  // Example: { linkedin: "https://www.linkedin.com/in/..." }
  links?: Record<string, string> | null;
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

  // Helper checks for "profile completion" notification.
  const hasAffiliation = Boolean(userProfile?.affiliation?.trim());
  const hasPhoneNumber = Boolean(userProfile?.phone_number?.trim());
  const hasLinkedIn = Boolean(userProfile?.links?.linkedin?.trim());

  // If we are logged in but have no `user_profiles` row yet, we still consider the profile incomplete.
  const needsProfileCompletion =
    Boolean(session) &&
    (!userProfile || !hasAffiliation || !hasPhoneNumber || !hasLinkedIn);

  const missingProfileFields: string[] = [];
  if (session) {
    if (!hasAffiliation) missingProfileFields.push("affiliation");
    if (!hasPhoneNumber) missingProfileFields.push("phone number");
    if (!hasLinkedIn) missingProfileFields.push("LinkedIn");
  }

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
          <AuthNavbarRight className="hidden lg:flex items-center gap-4" />

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
