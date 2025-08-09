"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EMAIL_CONTENT_TYPES } from "@/lib/email_templates/constants";
import { useState } from "react";
interface SendNotificationProps {
  eventId: string;
}

export default function SendGeneralNotification({
  eventId,
}: SendNotificationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSendGeneralNotification = async () => {
    setLoading(true);
    const response = await fetch("/api/email_notification", {
      method: "POST",
      body: JSON.stringify({
        eventId: eventId,
        email_content: EMAIL_CONTENT_TYPES.EVENT_SCHEDULE_UPDATE,
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
        description: "Email notication sent successfully!",
      });
    }
    setLoading(false);
  };

  return (
    <div>
      <Button onClick={handleSendGeneralNotification} disabled={loading}>
        Send General Notification
      </Button>
    </div>
  );
}
