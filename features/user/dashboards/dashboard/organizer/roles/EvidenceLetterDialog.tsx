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
  generateEvidenceLetterPdf,
  roundDownToNearest50,
  safeFileName,
} from "./generateLetterPdf";

export interface JudgeEvidenceContext {
  judgeName: string;
  judgeEmail: string;
  projectsJudged: number;
  eventName: string;
  eventDate: string;
  attendance: number;
  organizerName: string;
  organizerRole: string;
  organizerOrg: string;
}

interface EvidenceLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: JudgeEvidenceContext | null;
  onGenerated?: (judgeName: string) => void;
}

const DEFAULT_PRAISE =
  "performed exceptionally — bringing rigorous technical judgment, fairness, and clear, actionable feedback to every project they reviewed.";

const DEFAULT_SELECTIVITY =
  "was selected from a highly selective pool of applicant judges and";

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

function formatProjectsJudged(count: number): string {
  if (count === 1) return "1 project";
  return `${count.toLocaleString()} projects`;
}

export function EvidenceLetterDialog({
  open,
  onOpenChange,
  context,
  onGenerated,
}: EvidenceLetterDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const initialFormState = useMemo<EvidenceLetterData>(() => {
    if (!context) {
      return {
        recipientSalutation: "To Whom It May Concern",
        judgeName: "",
        eventName: "",
        eventDate: "",
        attendanceText: "",
        projectsJudgedText: "",
        selectivityLanguage: DEFAULT_SELECTIVITY,
        praiseParagraph: DEFAULT_PRAISE,
        organizerName: "",
        organizerRole: "",
        organizerOrg: "",
      };
    }
    return {
      recipientSalutation: "To Whom It May Concern",
      judgeName: context.judgeName,
      eventName: context.eventName,
      eventDate: formatEventDate(context.eventDate),
      attendanceText: formatAttendance(context.attendance),
      projectsJudgedText: formatProjectsJudged(context.projectsJudged),
      selectivityLanguage: DEFAULT_SELECTIVITY,
      praiseParagraph: DEFAULT_PRAISE,
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

  const handleGenerate = () => {
    if (!context) return;
    setGenerating(true);
    try {
      const doc = generateEvidenceLetterPdf(form);
      const filename = `evidence-letter-${safeFileName(form.judgeName)}-${safeFileName(form.eventName)}.pdf`;
      doc.save(filename);
      onGenerated?.(form.judgeName);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate evidence letter</DialogTitle>
          <DialogDescription>
            Customize the fields below and download a PDF letter validating this
            judge&rsquo;s service. Useful for O1 visa packets and other
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
              <Label htmlFor="judge-name">Judge name</Label>
              <Input
                id="judge-name"
                value={form.judgeName}
                onChange={(e) => update("judgeName", e.target.value)}
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
            <Label htmlFor="projects-judged">Projects judged</Label>
            <Input
              id="projects-judged"
              value={form.projectsJudgedText}
              onChange={(e) => update("projectsJudgedText", e.target.value)}
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !context}>
            {generating ? "Generating…" : "Generate Letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
