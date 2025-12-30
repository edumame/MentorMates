"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Eye } from "lucide-react";

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  recipientCount: number;
  onSend: (customMessage: string | null) => void;
  isSending?: boolean;
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  eventName,
  recipientCount,
  onSend,
  isSending = false,
}: EmailPreviewDialogProps) {
  const [customMessage, setCustomMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const handleSend = () => {
    onSend(customMessage.trim() || null);
  };

  const previewHtml = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb; font-size: 24px; text-align: center;">You're Invited!</h1>
      <p style="color: #374151;">Hi [Recipient Name],</p>
      <p style="color: #374151;">You've been invited to join <strong>${eventName}</strong> on MentorMates.</p>
      
      ${
        customMessage
          ? `
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="font-size: 14px; color: #92400e; margin: 0; font-style: italic;">"${customMessage}"</p>
          <p style="font-size: 12px; color: #92400e; margin: 8px 0 0 0;">— Event Organizers</p>
        </div>
      `
          : ""
      }
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h2 style="font-size: 18px; color: #1f2937; margin: 0 0 12px 0;">${eventName}</h2>
        <p style="font-size: 14px; color: #6b7280; margin: 4px 0;"><strong>Date:</strong> [Event Date]</p>
        <p style="font-size: 14px; color: #6b7280; margin: 4px 0;"><strong>Location:</strong> [Event Location]</p>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="#" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Accept Invitation
        </a>
      </div>
      
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">
        This invitation expires in 7 days
      </p>
    </div>
  `;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Invitations</DialogTitle>
          <DialogDescription>
            You are about to send invitations to {recipientCount} recipient
            {recipientCount !== 1 ? "s" : ""} for {eventName}.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">Customize Message</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              Preview Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="flex-1 space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="customMessage">
                Custom Message (Optional)
              </Label>
              <Textarea
                id="customMessage"
                placeholder="Add a personal message to include in all invitations..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This message will appear in the invitation email, attributed to
                the event organizers.
              </p>
            </div>
          </TabsContent>

          <TabsContent
            value="preview"
            className="flex-1 min-h-0 overflow-hidden mt-4"
          >
            <div className="border rounded-lg h-full overflow-auto bg-white">
              <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                className="p-4"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              "Sending..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send {recipientCount} Invitation{recipientCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

