"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/hooks/use-toast";
import {
  clearJoinEventIntent,
  readJoinEventIntent,
} from "@/features/events/join-flow/join-event-intent";

interface PostPaymentJoinProps {
  eventId: string;
}

export function PostPaymentJoin({ eventId }: PostPaymentJoinProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const router = useRouter();

  const processEventJoin = useCallback(async () => {
    if (isProcessing || hasProcessed) return;

    setIsProcessing(true);

    try {
      const joinIntent = readJoinEventIntent();
      if (!joinIntent?.userId) {
        toast({
          title: "Error",
          description: "Please try joining the event again.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/roles/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(joinIntent),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Registration Error",
          description: data.error || "Failed to complete event registration. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      // Success!
      clearJoinEventIntent(joinIntent.eventId);
      setHasProcessed(true);

      toast({
        title: "Success!",
        description: "You've successfully registered for the event!",
      });

      // Redirect to event page
      setTimeout(() => {
        router.push(`/events/${eventId}/overview`);
      }, 2000);

    } catch (error) {
      console.error("Error processing event join: ", error);
      toast({
        title: "Error",
        description: "Failed to complete registration. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, hasProcessed, eventId, router]);

  // Auto-process on component mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      processEventJoin();
    }, 1000); // Small delay to ensure the page has loaded

    return () => clearTimeout(timeoutId);
  }, [processEventJoin]);

  if (hasProcessed) {
    return (
      <div className="text-center">
        <div className="text-green-600 font-semibold mb-2">
          ✅ Registration Complete!
        </div>
        <p className="text-sm text-gray-600">
          Redirecting you to the event page...
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Button
        onClick={processEventJoin}
        disabled={isProcessing}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
      >
        {isProcessing ? "Processing..." : "Complete Registration"}
      </Button>
      {isProcessing && (
        <p className="text-sm text-gray-600 mt-2">
          Completing your event registration...
        </p>
      )}
    </div>
  );
}
