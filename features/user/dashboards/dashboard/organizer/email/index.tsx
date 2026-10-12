"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Send, Users, Eye, Loader2, LayoutTemplate } from "lucide-react";
import { EventRole } from "@/lib/types";
import { EmailTemplates } from "./templates";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";

interface Recipient {
  id: string;
  email: string;
  display_name: string;
  role: EventRole;
}

interface EmailTabProps {
  eventId: string;
}

export function EmailTab({ eventId }: EmailTabProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState<string>("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { toast } = useToast();

  // Fetch all event participants
  useEffect(() => {
    async function fetchRecipients() {
      try {
        const response = await fetch(
          `/api/events/${eventId}/users?roles=participant,mentor,judge,organizer,admin&limit=500`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load recipients");

        const recipientList: Recipient[] = (payload.users || [])
          .filter((user: { email: string }) => Boolean(user.email))
          .map(
            (user: {
              user_id: string;
              role: EventRole;
              email: string;
              display_name: string;
            }) => ({
              id: user.user_id,
              email: user.email,
              display_name: user.display_name,
              role: user.role as EventRole,
            })
          );

        setRecipients(recipientList);
      } catch (error) {
        console.error("Error fetching recipients:", error);
        toast({
          title: "Error",
          description: "Failed to load recipients",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecipients();
  }, [eventId, toast]);

  // Filter recipients based on selected filter
  const filteredRecipients = recipients.filter((recipient) => {
    if (recipientFilter === "all") return true;
    return recipient.role === recipientFilter;
  });

  // Handle recipient selection
  const handleRecipientToggle = (recipientId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(recipientId)
        ? prev.filter((id) => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  // Select all filtered recipients
  const handleSelectAll = () => {
    const filteredIds = filteredRecipients.map((r) => r.id);
    setSelectedRecipients(filteredIds);
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedRecipients([]);
  };

  // Send email
  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both subject and message",
        variant: "destructive",
      });
      return;
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const selectedEmails = recipients
        .filter((r) => selectedRecipients.includes(r.id))
        .map((r) => r.email);

      const response = await fetch("/api/email_notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "admin@mentormates.ai",
          from: NOTIFICATIONS_EMAIL_FROM,
          subject,
          bcc: selectedEmails,
          html: generateEmailPreview(),
        }),
      });

      if (!response.ok) {
        if (response.status === 422) {
          throw new Error("Some emails failed to send. Reselect less recipients and try again.");
        } else {
          throw new Error("Failed to send email");
        }
      }

      toast({
        title: "Success",
        description: `Email sent to ${selectedEmails.length} recipients`,
      });

      // Reset form
      setSubject("");
      setMessage("");
      setSelectedRecipients([]);
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const generateEmailPreview = () => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">${subject}</h1>
        <div style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px; white-space: pre-wrap;">
          ${message.replace(/\n/g, "<br>")}
        </div>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
            Best regards,
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
            The Event Organizers
          </p>
        </div>
      </div>
    `;
  };

  // Handle template selection
  const handleSelectTemplate = (template: {
    subject: string;
    message: string;
    name: string;
  }) => {
    setSubject(template.subject);
    setMessage(template.message);
    setShowTemplates(false);
    toast({
      title: "Template Applied",
      description: `"${template.name}" template has been loaded. You can customize it as needed.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-geist flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to Event Participants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Composition */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                rows={8}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 rounded-[12px]"
            >
              <LayoutTemplate className="h-4 w-4" />
              {showTemplates ? "Hide Templates" : "Use Template"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 rounded-[12px]"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>

          {/* Email Templates */}
          {showTemplates && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Choose Template</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailTemplates onSelectTemplate={handleSelectTemplate} />
              </CardContent>
            </Card>
          )}

          {/* Email Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Email Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border rounded p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: generateEmailPreview() }}
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Recipients Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="font-geist flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Recipients ({selectedRecipients.length} selected)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter and Actions */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label>Filter by role:</Label>
              <Select
                value={recipientFilter}
                onValueChange={setRecipientFilter}
              >
                <SelectTrigger className="w-40 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value={EventRole.Participant}>
                    Participants
                  </SelectItem>
                  <SelectItem value={EventRole.Mentor}>Mentors</SelectItem>
                  <SelectItem value={EventRole.Judge}>Judges</SelectItem>
                  <SelectItem value={EventRole.Organizer}>
                    Organizers
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-[12px]" onClick={handleSelectAll}>
                Select All ({filteredRecipients.length})
              </Button>
              <Button variant="outline" size="sm" className="rounded-[12px]" onClick={handleClearAll}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Recipients List */}
          <div className="max-h-64 overflow-y-auto border rounded p-4 space-y-2">
            {filteredRecipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded"
              >
                <Checkbox
                  checked={selectedRecipients.includes(recipient.id)}
                  onCheckedChange={() => handleRecipientToggle(recipient.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{recipient.display_name}</div>
                  <div className="text-sm text-gray-500">
                    {recipient.email} • {recipient.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Send Button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              onClick={handleSendEmail}
              disabled={isSending || selectedRecipients.length === 0}
              className="flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-900" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSending
                ? "Sending..."
                : `Send to ${selectedRecipients.length} recipients`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
