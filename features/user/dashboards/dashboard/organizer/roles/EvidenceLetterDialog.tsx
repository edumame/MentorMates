"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import {
  EvidenceLetterData,
  EvidenceLetterRole,
  generateEvidenceLetterPdf,
  roundDownToNearest50,
  safeFileName,
} from "./generateLetterPdf";

export interface RecipientEvidenceContext {
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  roleNoun: EvidenceLetterRole;
  serviceCount: number;
  eventId: string;
  eventName: string;
  eventDate: string;
  attendance: number;
  organizerName: string;
  organizerRole: string;
  organizerOrg: string;
}

// Backwards-compatible alias for legacy import sites.
export type JudgeEvidenceContext = RecipientEvidenceContext;

interface EvidenceLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: RecipientEvidenceContext | null;
  onGenerated?: (recipientName: string) => void;
}

const DEFAULT_PRAISE: Record<EvidenceLetterRole, string> = {
  judge:
    "performed exceptionally — bringing rigorous technical judgment, fairness, and clear, actionable feedback to every project they reviewed.",
  mentor:
    "performed exceptionally — bringing deep technical expertise, generous coaching, and clear, actionable feedback to every team they supported.",
};

const DEFAULT_SELECTIVITY: Record<EvidenceLetterRole, string> = {
  judge:
    "was selected from a highly selective pool of applicant judges and",
  mentor:
    "was selected from a highly selective pool of applicant mentors and",
};

const SERVICE_VERB: Record<EvidenceLetterRole, string> = {
  judge: "evaluated",
  mentor: "mentored",
};

function formatEventDate(raw: string): string {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAttendance(attendance: number): string {
  const rounded = roundDownToNearest50(attendance);
  if (rounded <= 0) {
    return `${attendance} attendees`;
  }
  return `more than ${rounded.toLocaleString()} attendees`;
}

function formatServiceCount(count: number): string {
  if (count === 1) return "1 project";
  return `${count.toLocaleString()} projects`;
}

async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch("/mentormate.png");
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Failed to load MentorMates logo for letter PDF", err);
    return undefined;
  }
}

export function EvidenceLetterDialog({
  open,
  onOpenChange,
  context,
  onGenerated,
}: EvidenceLetterDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadLogoDataUrl().then((url) => {
      if (!cancelled) setLogoDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const initialFormState = useMemo<EvidenceLetterData>(() => {
    if (!context) {
      return {
        recipientSalutation: "To Whom It May Concern",
        recipientName: "",
        roleNoun: "judge",
        serviceVerb: SERVICE_VERB.judge,
        eventName: "",
        eventDate: "",
        attendanceText: "",
        serviceCountText: "",
        selectivityLanguage: DEFAULT_SELECTIVITY.judge,
        praiseParagraph: DEFAULT_PRAISE.judge,
        organizerName: "",
        organizerRole: "",
        organizerOrg: "",
      };
    }
    const role = context.roleNoun;
    return {
      recipientSalutation: "To Whom It May Concern",
      recipientName: context.recipientName,
      roleNoun: role,
      serviceVerb: SERVICE_VERB[role],
      eventName: context.eventName,
      eventDate: formatEventDate(context.eventDate),
      attendanceText: formatAttendance(context.attendance),
      serviceCountText: formatServiceCount(context.serviceCount),
      selectivityLanguage: DEFAULT_SELECTIVITY[role],
      praiseParagraph: DEFAULT_PRAISE[role],
      organizerName: context.organizerName,
      organizerRole: context.organizerRole,
      organizerOrg: context.organizerOrg,
    };
  }, [context]);

  const [form, setForm] = useState<EvidenceLetterData>(initialFormState);

  useEffect(() => {
    setForm(initialFormState);
  }, [initialFormState]);

  const update = <K extends keyof EvidenceLetterData>(
    key: K,
    value: EvidenceLetterData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const roleLabel = form.roleNoun === "mentor" ? "mentor" : "judge";
  const roleLabelTitle = roleLabel === "mentor" ? "Mentor" : "Judge";
  const dialogTitle = `Generate evidence letter for ${roleLabelTitle.toLowerCase()}`;

  const buildFilename = () =>
    `evidence-letter-${roleLabel}-${safeFileName(form.recipientName)}-${safeFileName(form.eventName)}.pdf`;

  const handleGenerate = () => {
    if (!context) return;
    setGenerating(true);
    try {
      const doc = generateEvidenceLetterPdf({ ...form, logoDataUrl });
      const filename = buildFilename();
      doc.save(filename);
      onGenerated?.(form.recipientName);
      toast({
        title: "Letter downloaded",
        description: `${filename} has been saved.`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to generate evidence letter PDF", err);
      toast({
        title: "Couldn't generate letter",
        description:
          err instanceof Error ? err.message : "Unknown error generating PDF",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleEmail = async () => {
    if (!context) return;
    setEmailing(true);
    try {
      const res = await fetch(
        `/api/events/${context.eventId}/users/${context.recipientUserId}/email-evidence-letter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letterData: form }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        sentTo?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Failed to send email");
      }
      toast({
        title: `Letter emailed to ${roleLabel}`,
        description: json.sentTo
          ? `Sent to ${json.sentTo}.`
          : "Email sent successfully.",
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to email evidence letter", err);
      toast({
        title: "Couldn't email letter",
        description:
          err instanceof Error ? err.message : "Unknown error sending email",
        variant: "destructive",
      });
    } finally {
      setEmailing(false);
    }
  };

  const busy = generating || emailing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Customize the fields below and either download the PDF or email it
            directly to the {roleLabel}. Useful for O1 visa packets and other
            third-party verification.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="recipient-salutation">Recipient salutation</Label>
            <Input
              id="recipient-salutation"
              value={form.recipientSalutation}
              onChange={(e) => update("recipientSalutation", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="recipient-name">{roleLabelTitle} name</Label>
              <Input
                id="recipient-name"
                value={form.recipientName}
                onChange={(e) => update("recipientName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event name</Label>
              <Input
                id="event-name"
                value={form.eventName}
                onChange={(e) => update("eventName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-date">Event date</Label>
              <Input
                id="event-date"
                value={form.eventDate}
                onChange={(e) => update("eventDate", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendance-text">Attendance</Label>
              <Input
                id="attendance-text"
                value={form.attendanceText}
                onChange={(e) => update("attendanceText", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Default rounds down to the nearest 50.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="service-count">
              Projects {roleLabel === "mentor" ? "mentored" : "judged"}
            </Label>
            <Input
              id="service-count"
              value={form.serviceCountText}
              onChange={(e) => update("serviceCountText", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="selectivity">Selectivity language</Label>
            <Textarea
              id="selectivity"
              value={form.selectivityLanguage}
              onChange={(e) => update("selectivityLanguage", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="praise">Praise paragraph</Label>
            <Textarea
              id="praise"
              value={form.praiseParagraph}
              onChange={(e) => update("praiseParagraph", e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="organizer-name">Signatory name</Label>
              <Input
                id="organizer-name"
                value={form.organizerName}
                onChange={(e) => update("organizerName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organizer-role">Role / title</Label>
              <Input
                id="organizer-role"
                value={form.organizerRole}
                onChange={(e) => update("organizerRole", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organizer-org">Organization</Label>
              <Input
                id="organizer-org"
                value={form.organizerOrg}
                onChange={(e) => update("organizerOrg", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleEmail}
            disabled={busy || !context}
          >
            {emailing ? "Sending…" : `Email to ${roleLabel}`}
          </Button>
          <Button onClick={handleGenerate} disabled={busy || !context}>
            {generating ? "Generating…" : "Generate Letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
