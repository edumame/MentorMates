import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserProfile } from "@/lib/types";
interface UseProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsLoading(false);
        setError("No session found");
        return;
      }

      if (!session?.user?.id) {
        setIsLoading(false);
        setError("No user ID found in session");
        return;
      }
      // Fetch own profile by authenticated user ID
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from("user_profiles")
          .select("uid, display_name")
          .eq("uid", session.user.id)
          .single();

        if (profileError || !userProfile) {
          setIsLoading(false);
          setError("Error fetching user profile");
        }

        setProfile(userProfile);
      } catch (error) {
        setIsLoading(false);
        setError("Error fetching user profile");
        console.error(error);
      }
    };

    loadProfile();
  }, []);

  return {
    profile,
    isLoading,
    error,
  };
}
