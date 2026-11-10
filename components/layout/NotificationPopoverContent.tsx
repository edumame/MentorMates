"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  getMissingProfileFieldLabels,
  loadProfileCompletionFields,
  profileNeedsCompletion,
  type ProfileCompletionFields,
} from "@/features/user/profile/profile-completion";
import { NotificationsNone } from "@mui/icons-material";
import { GraduationCap } from "lucide-react";


export function useNotificationData() {
  const [session, setSession] = useState<Session | null>(null);
  const [completionFields, setCompletionFields] =
    useState<ProfileCompletionFields | null>(null);
  const [completionLoaded, setCompletionLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Shared by the bell, the desktop sidebar and the mobile drawer so all
    // three agree; includes the phone number from user_phone_numbers.
    loadProfileCompletionFields(supabase, userId)
      .then((fields) => {
        if (active) setCompletionFields(fields);
      })
      .catch(() => {
        if (active) setCompletionFields(null);
      })
      .finally(() => {
        if (active) setCompletionLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const userProfile = completionFields;

  // Don't flash the reminder before the fields have loaded.
  const needsProfileCompletion =
    Boolean(session) && completionLoaded && profileNeedsCompletion(userProfile);
  const missingProfileFields =
    session && completionLoaded ? getMissingProfileFieldLabels(userProfile) : [];

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
