"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailDashboard from "./EmailDashboard";
import { supabase } from "@/lib/supabase";

interface SendNotificationProps {
  eventId: string;
}

export default function SendGeneralNotification({
  eventId,
}: SendNotificationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    const fetchEventName = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("name")
        .eq("event_id", eventId)
        .single();

      if (!error && data) {
        setEventName(data.name);
      }
    };

    fetchEventName();
  }, [eventId]);

  const handleSendGeneralNotification = async () => {
    setLoading(true);
    const response = await fetch(`/api/email_notification/event/${eventId}`, {
      method: "POST",
      body: JSON.stringify({
        eventId: eventId,
        emailType: EMAIL_TYPES.EVENT_SCHEDULE_UPDATE,
      }),
    });

    if (!response.ok) {
      toast({
        title: "Notification failed to send",
        description: "Email notification failed to send. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Notification sent",
        description: "Email notification sent successfully!",
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Event Notifications</h1>
      
      <Tabs defaultValue="individual" className="w-full">
        <TabsList>
          <TabsTrigger value="individual">Individual Notifications</TabsTrigger>
          <TabsTrigger value="general">General Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <EmailDashboard eventId={eventId} eventName={eventName} />
        </TabsContent>

        <TabsContent value="general">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Send General Notifications</h2>
              <p className="text-gray-600">
                Send notifications to all event participants.
              </p>
            </div>
            
            <Button onClick={handleSendGeneralNotification} disabled={loading}>
              {loading ? "Sending..." : "Send General Notification"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
