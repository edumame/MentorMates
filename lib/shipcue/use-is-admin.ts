"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";

/** Whether the signed-in user is an admin (they also get the Agent task tab). */
export function useIsAdmin(userId: string | undefined): boolean {
  const [isAdmin, setIsAdmin] = React.useState(false);
  React.useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let live = true;
    void Promise.resolve(supabase.rpc("is_admin_user", { user_id: userId })).then(
      ({ data }) => live && setIsAdmin(Boolean(data)),
      () => live && setIsAdmin(false)
    );
    return () => {
      live = false;
    };
  }, [userId]);
  return isAdmin;
}
