import { supabase } from "../supabase";
import { useEffect, useState } from "react";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.rpc("is_admin_user", {
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, []);

  return isAdmin;
}