"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UseHasJoinedEventResult {
  hasJoined: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Checks whether the authenticated user has joined the given event.
 * A user is considered "joined" if any of the following are true:
 * - They have a role in `user_event_roles` for the event
 * - They have an assigned ticket in `event_tickets` for the event (status assigned or used)
 * - They have a paid payment record in `user_event_payments` for the event
 */
export function useHasJoinedEvent(eventId: string): UseHasJoinedEventResult {
  const [hasJoined, setHasJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkMembership = async () => {
    
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (mountedRef.current) {
          setHasJoined(false);
          setLoading(false);
        }
        return;
      }

      const userId = session.user.id;

      // 1) Check explicit role assignment
      const { data: roleRow, error: roleError } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (roleError) {
        // Do not throw; try other signals and report at the end
        // Keep last error message for debugging visibility
        setError(roleError.message);
      }

      if (roleRow) {
        if (mountedRef.current) {
          setHasJoined(true);
          setLoading(false);
        }
        return;
      }

      // 2) Check assigned ticket to this user for the event
      const { data: ticketRow, error: ticketError } = await supabase
        .from("event_tickets")
        .select("ticket_status")
        .eq("assigned_to_user_id", userId)
        .eq("event_id", eventId)
        .in("ticket_status", ["assigned", "used"]) // valid active tickets
        .maybeSingle();

      if (ticketError) {
        setError(ticketError.message);
      }

      if (ticketRow) {
        if (mountedRef.current) {
          setHasJoined(true);
          setLoading(false);
        }
        return;
      }

      // 3) Check paid payment record (fallback)
      const { data: paymentRow, error: paymentError } = await supabase
        .from("user_event_payments")
        .select("id")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .eq("payment_status", "paid")
        .maybeSingle();

      if (paymentError) {
        setError(paymentError.message);
      }

      if (mountedRef.current) {
        setHasJoined(!!paymentRow);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setHasJoined(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!eventId) return;
    checkMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return { hasJoined, loading, error, refetch: checkMembership };
}

