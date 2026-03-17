"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { UserProfile } from "@/lib/types";
import { NotificationsNone } from "@mui/icons-material";
import { GraduationCap } from "lucide-react";

interface ExtendedUserProfile extends UserProfile {
  onboarding_metadata: Record<string, unknown> | null;
  affiliation: string | null;
  phone_number?: string | null;
  links?: Record<string, string> | null;
}

export function useNotificationData() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<ExtendedUserProfile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
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

  const hasAffiliation = Boolean(userProfile?.affiliation?.trim());
  const hasPhoneNumber = Boolean(userProfile?.phone_number?.trim());
  const hasLinkedIn = Boolean(userProfile?.links?.linkedin?.trim());
  const needsProfileCompletion =
    Boolean(session) &&
    (!userProfile || !hasAffiliation || !hasPhoneNumber || !hasLinkedIn);

  const missingProfileFields: string[] = [];
  if (session) {
    if (!hasAffiliation) missingProfileFields.push("affiliation");
    if (!hasPhoneNumber) missingProfileFields.push("phone number");
    if (!hasLinkedIn) missingProfileFields.push("LinkedIn");
  }

  return {
    session,
    userProfile,
    needsProfileCompletion,
    missingProfileFields,
  };
}

export function NotificationPopoverContent() {
  const { session, needsProfileCompletion, missingProfileFields } = useNotificationData();

  return (
    <>
      <div className="p-4">
        <div className="flex items-center gap-1">
          <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.5px] text-black">
            Notification
          </h3>
          <div className="border border-[rgba(0,0,0,0.15)] border-solid rounded-[50px] px-2 py-0">
            <p className="text-[14px] font-normal leading-[1.5] text-black">
              {needsProfileCompletion ? "1" : "0"}
            </p>
          </div>
        </div>
      </div>
      {needsProfileCompletion && session ? (
        <div className="px-4 pb-4">
          <Link
            href={`/profile/${session.user.id}?edit=1`}
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
                Add your{" "}
                {missingProfileFields.length > 0
                  ? missingProfileFields.join(", ")
                  : "details"}{" "}
                to help others connect with you.
              </p>
            </div>
          </Link>
        </div>
      ) : (
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
    </>
  );
}
