"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Papa from "papaparse";
import { Download } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  IntakeFormContext,
  IntakeFormSchema,
} from "@/features/intake-forms/types";
import { useToast } from "@/lib/hooks/use-toast";
import {
  buildIntakeExportRows,
  formatAnswerValue,
  getFieldLabel,
  isFieldVisible,
  mapAnswersByFieldKey,
  type IntakeAnswerRecord,
} from "./intake-responses-utils";
import Link from "next/link";

type ActiveIntakeForm = {
  formVersionId: string;
  versionNumber: number;
  schema: IntakeFormSchema;
};

type Submission = {
  id: string;
  submitterUserId: string;
  formVersionId: string;
  submittedAt: string | null;
  submitterProfile: {
    display_name: string | null;
    email: string | null;
  } | null;
  answers: IntakeAnswerRecord[];
  projectId: string | null;
};

const PAGE_SIZE = 20;
const CONTEXT_LABELS: Record<IntakeFormContext, string> = {
  registration: "Registration",
  project_submission: "Project Submission",
};

export function IntakeResponsesTab({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [context, setContext] = useState<IntakeFormContext>("registration");
  const [activeForm, setActiveForm] = useState<ActiveIntakeForm | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    const loadActiveForm = async () => {
      try {
        setLoadingForm(true);
        const response = await fetch(
          `/api/events/${eventId}/intake-form?context=${context}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to load active intake form");
        }

        const payload = (await response.json()) as {
          form: ActiveIntakeForm | null;
        };
        if (!cancelled) {
          setActiveForm(payload.form ?? null);
        }
      } catch (error) {
        if (cancelled) return;
        setActiveForm(null);
        toast({
          title: "Could not load active form",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingForm(false);
      }
    };

    loadActiveForm();

    return () => {
      cancelled = true;
    };
  }, [context, eventId, toast]);

  useEffect(() => {
    let cancelled = false;

    const loadResponses = async () => {
      try {
        setLoadingResponses(true);
        const response = await fetch(
          `/api/events/${eventId}/intake-form/submissions?context=${context}&limit=${PAGE_SIZE}&offset=${offset}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to load intake responses");
        }

        const payload = (await response.json()) as {
          submissions: Submission[];
          pagination: { total: number };
        };

        if (cancelled) return;
        setSubmissions(payload.submissions ?? []);
        setTotal(payload.pagination?.total ?? 0);
      } catch (error) {
        if (cancelled) return;
        toast({
          title: "Could not load responses",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingResponses(false);
      }
    };

    loadResponses();

    return () => {
      cancelled = true;
    };
  }, [context, eventId, offset, toast]);

  useEffect(() => {
    setOffset(0);
    setSelectedSubmissionId(null);
  }, [context]);

  const selectedSubmission = useMemo(() => {
    if (!selectedSubmissionId) return null;
    return (
      submissions.find(
        (submission) => submission.id === selectedSubmissionId
      ) ?? null
    );
  }, [selectedSubmissionId, submissions]);

  const selectedSubmissionDisplayRows = useMemo(() => {
    if (!selectedSubmission) return [];

    const answersByKey = mapAnswersByFieldKey(selectedSubmission.answers);
    const schemaFields = activeForm?.schema?.fields ?? [];

    const knownRows = schemaFields
      .filter((field) => isFieldVisible(field, answersByKey))
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: formatAnswerValue(answersByKey[field.key]),
      }));

    const knownKeys = new Set(schemaFields.map((field) => field.key));
    const unknownRows = selectedSubmission.answers
      .filter((answer) => !knownKeys.has(answer.fieldKey))
      .map((answer) => ({
        key: answer.fieldKey,
        label: answer.fieldKey,
        value: formatAnswerValue(answer.value),
      }));

    return [...knownRows, ...unknownRows];
  }, [selectedSubmission, activeForm]);

  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    try {
      setExporting(true);

      // Fetch all submissions across pages (API caps limit at 100).
      const EXPORT_PAGE_SIZE = 100;
      const allSubmissions: Submission[] = [];
      let exportOffset = 0;
      let exportTotal = Infinity;

      while (exportOffset < exportTotal) {
        const response = await fetch(
          `/api/events/${eventId}/intake-form/submissions?context=${context}&limit=${EXPORT_PAGE_SIZE}&offset=${exportOffset}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to fetch responses for export");
        }
        const payload = (await response.json()) as {
          submissions: Submission[];
          pagination: { total: number };
        };
        allSubmissions.push(...(payload.submissions ?? []));
        exportTotal = payload.pagination?.total ?? allSubmissions.length;
        if ((payload.submissions ?? []).length === 0) break;
        exportOffset += EXPORT_PAGE_SIZE;
      }

      if (allSubmissions.length === 0) {
        toast({
          title: "Nothing to export",
          description: "There are no submitted responses yet.",
        });
        return;
      }

      const rows = buildIntakeExportRows(
        allSubmissions,
        activeForm?.schema ?? null
      );

      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `intake-${context}-${eventId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: `Downloaded ${rows.length} ${
          rows.length === 1 ? "response" : "responses"
        }.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrev = offset > 0;
  const canGoNext = offset + PAGE_SIZE < total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle
          className="font-geist font-semibold leading-[140%] tracking-[-1.32px] text-[var(--Color-Scheme-1-Text,#000)]"
          style={{ fontSize: "var(--Text-Sizes-Heading-6, 22px)" }}
        >
          Intake Responses
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={exporting || loadingResponses || total === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={context}
          onValueChange={(value) => setContext(value as IntakeFormContext)}
        >
          <TabsList className="flex h-auto gap-2 p-0 justify-start bg-transparent border-0 shadow-none rounded-none mb-6">
            <TabsTrigger
              value="registration"
              className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
            >
              Registration
            </TabsTrigger>
            <TabsTrigger
              value="project_submission"
              className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
            >
              Project Submission
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loadingForm ? (
          <p className="text-sm text-muted-foreground">
            Loading form details...
          </p>
        ) : activeForm ? (
          <div className="text-sm text-muted-foreground">
            Active {CONTEXT_LABELS[context]} form:{" "}
            <span className="font-medium">{activeForm.schema.title}</span>{" "}
            <Badge variant="outline" className="ml-2">
              v{activeForm.versionNumber}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active {CONTEXT_LABELS[context].toLowerCase()} intake form is
            currently published.
          </p>
        )}

        {loadingResponses ? (
          <p className="text-sm text-muted-foreground">Loading responses...</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {CONTEXT_LABELS[context].toLowerCase()} intake responses have
            been submitted yet.
          </p>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Answers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    <TableHead className="text-right sm:text-center">View Project</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    const displayName =
                      submission.submitterProfile?.display_name?.trim() ||
                      submission.submitterProfile?.email?.split("@")[0] ||
                      submission.submitterUserId;
                    const submittedAt = submission.submittedAt
                      ? format(new Date(submission.submittedAt), "PPP p")
                      : "-";

                    return (
                      <TableRow key={submission.id}>
                        <TableCell>{displayName}</TableCell>
                        <TableCell>
                          {submission.submitterProfile?.email ?? "-"}
                        </TableCell>
                        <TableCell>{submittedAt}</TableCell>
                        <TableCell>{submission.answers.length}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSelectedSubmissionId(submission.id)
                            }
                          >
                            View
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/projects/public/${submission.projectId}`} passHref>
                            <Button variant="outline" size="sm">
                              View Project
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pageNumber} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canGoPrev}
                  onClick={() =>
                    setOffset((current) => Math.max(0, current - PAGE_SIZE))
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canGoNext}
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog
        open={Boolean(selectedSubmission)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedSubmissionId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Intake Response Details</DialogTitle>
          </DialogHeader>

          {selectedSubmission ? (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Participant:</span>{" "}
                  {selectedSubmission.submitterProfile?.display_name ||
                    selectedSubmission.submitterUserId}
                </p>
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {selectedSubmission.submitterProfile?.email || "-"}
                </p>
              </div>

              <div className="space-y-3">
                {selectedSubmissionDisplayRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No answers were recorded.
                  </p>
                ) : (
                  selectedSubmissionDisplayRows.map((row) => (
                    <div key={row.key} className="rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {getFieldLabel(row.key, activeForm?.schema ?? null)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.value}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
