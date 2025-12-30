"use client";

import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";

type LumaApprovalStatus =
  | "approved"
  | "pending_approval"
  | "declined"
  | "invited"
  | "unknown";

type ValidationStatus =
  | "valid"
  | "missing_email"
  | "invalid_email"
  | "duplicate_email";

type LumaRow = {
  // Minimal participant info we use for emailing
  email: string;
  name: string;

  // Useful metadata for preview/filtering (MVP: we don't store it server-side)
  approvalStatus: LumaApprovalStatus;
  checkedInAt?: string;
  ticketName?: string;
  qrCodeUrl?: string;
};

type PreviewRow = LumaRow & {
  rowNumber: number; // 1-based row number in CSV (excluding header)
  validation: ValidationStatus;
  selected: boolean;
};

const EmailSchema = z.string().email();

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function pickName(raw: Record<string, string>): string {
  const name = (raw["name"] ?? "").trim();
  if (name) return name;

  const first = (raw["first_name"] ?? "").trim();
  const last = (raw["last_name"] ?? "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unknown";
}

function parseApprovalStatus(raw: Record<string, string>): LumaApprovalStatus {
  const v = (raw["approval_status"] ?? "").trim().toLowerCase();
  if (v === "approved" || v === "pending_approval" || v === "declined" || v === "invited") return v;
  return "unknown";
}

function validateEmail(emailRaw: string): "ok" | "missing" | "invalid" {
  const email = emailRaw.trim();
  if (!email) return "missing";
  const parsed = EmailSchema.safeParse(email);
  return parsed.success ? "ok" : "invalid";
}

function getDefaultSelected(status: LumaApprovalStatus): boolean {
  // Beginner-friendly default: send to people most likely to want the invite.
  return status === "approved" || status === "invited";
}

export function LumaCsvImport({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [statusFilter, setStatusFilter] = useState<LumaApprovalStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const selected = rows.filter((r) => r.selected).length;
    const invalid = rows.filter((r) => r.validation !== "valid").length;
    const duplicates = rows.filter((r) => r.validation === "duplicate_email").length;
    return { total, selected, invalid, duplicates };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (showOnlySelected && !r.selected) return false;
      if (statusFilter !== "all" && r.approvalStatus !== statusFilter) return false;

      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.ticketName || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, showOnlySelected, statusFilter]);

  const selectedValidRows = useMemo(
    () => rows.filter((r) => r.selected && r.validation === "valid"),
    [rows]
  );

  const setAllVisibleSelection = (selected: boolean) => {
    const visibleSet = new Set(filteredRows.map((r) => r.rowNumber));
    setRows((prev) =>
      prev.map((r) => (visibleSet.has(r.rowNumber) ? { ...r, selected } : r))
    );
  };

  const removeInvalidRows = () => {
    setRows((prev) => prev.filter((r) => r.validation === "valid"));
  };

  const removeDuplicates = () => {
    setRows((prev) => prev.filter((r) => r.validation !== "duplicate_email"));
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setRows([]);

    try {
      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => normalizeHeader(h),
          // Remove wrapping quotes that sometimes show up in exports
          transform: (value) => value.replaceAll('"', "").trim(),
          complete: (result) => resolve(result),
          error: (err) => reject(err),
        });
      });

      if (parsed.errors?.length) {
        console.warn("PapaParse errors:", parsed.errors);
      }

      const emailSeen = new Set<string>();
      const nextRows: PreviewRow[] = (parsed.data || [])
        .map((raw, index) => {
          const emailRaw = (raw["email"] ?? "").trim();
          const emailNormalized = emailRaw.toLowerCase();
          const name = pickName(raw);
          const approvalStatus = parseApprovalStatus(raw);

          const emailValidation = validateEmail(emailRaw);
          let validation: ValidationStatus;
          if (emailValidation === "missing") {
            validation = "missing_email";
          } else if (emailValidation === "invalid") {
            validation = "invalid_email";
          } else if (emailSeen.has(emailNormalized)) {
            validation = "duplicate_email";
          } else {
            validation = "valid";
          }

          if (emailValidation === "ok") emailSeen.add(emailNormalized);

          const row: PreviewRow = {
            rowNumber: index + 1,
            email: emailRaw,
            name,
            approvalStatus,
            checkedInAt: (raw["checked_in_at"] ?? "").trim() || undefined,
            ticketName: (raw["ticket_name"] ?? "").trim() || undefined,
            qrCodeUrl: (raw["qr_code_url"] ?? "").trim() || undefined,
            validation,
            selected: validation === "valid" ? getDefaultSelected(approvalStatus) : false,
          };
          return row;
        })
        // drop fully-empty rows that can occur from weird exports
        .filter((r) => r.email || r.name !== "Unknown" || r.ticketName || r.qrCodeUrl);

      setRows(nextRows);
      toast({
        title: "CSV loaded",
        description: `Parsed ${nextRows.length} rows.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse CSV.";
      toast({ title: "CSV parse failed", description: message, variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const sendInvites = async () => {
    if (selectedValidRows.length === 0) {
      toast({
        title: "Nothing to send",
        description: "Select at least 1 valid row.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/events/invite-participants-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          participants: selectedValidRows.map((r) => ({
            email: r.email,
            name: r.name,
            approvalStatus: r.approvalStatus,
            checkedInAt: r.checkedInAt,
            ticketName: r.ticketName,
          })),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { sent: string[]; failed: Array<{ email: string; error: string }> }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to send invitations.";
        throw new Error(msg);
      }

      const sent = data && "sent" in data ? data.sent : [];
      const failed = data && "failed" in data ? data.failed : [];

      if (sent.length > 0) {
        toast({
          title: "Invitations sent",
          description: `Sent ${sent.length} invitation(s).${failed.length ? ` ${failed.length} failed.` : ""}`,
        });
      } else {
        toast({
          title: "No invitations sent",
          description: failed.length ? `${failed.length} failed.` : "No recipients were sent.",
          variant: "destructive",
        });
      }

      // If some failed, keep them selected so the organizer can retry quickly.
      if (failed.length > 0) {
        const failedSet = new Set(failed.map((f) => f.email.toLowerCase()));
        setRows((prev) =>
          prev.map((r) => {
            const shouldKeepSelected = r.validation === "valid" && failedSet.has(r.email.toLowerCase());
            return { ...r, selected: shouldKeepSelected };
          })
        );
      } else {
        // All good, clear selection.
        setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invitations.";
      toast({ title: "Send failed", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const headerCheckboxState = useMemo(() => {
    if (filteredRows.length === 0) return { checked: false, indeterminate: false };
    const selectedCount = filteredRows.filter((r) => r.selected).length;
    return {
      checked: selectedCount === filteredRows.length,
      indeterminate: selectedCount > 0 && selectedCount < filteredRows.length,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import participants from Luma (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Beginner note: We hide the <input type="file" /> and trigger it with a button for nicer UX */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isSending}
              >
                {isParsing ? "Parsing..." : "Upload CSV"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setSearch("");
                  setStatusFilter("all");
                  setShowOnlySelected(false);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={rows.length === 0 || isParsing || isSending}
              >
                Clear
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Rows: {stats.total} • Selected: {stats.selected} • Invalid: {stats.invalid} • Duplicates: {stats.duplicates}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="luma-search">Search</Label>
                <Input
                  id="luma-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, ticket..."
                  disabled={isParsing || isSending}
                />
              </div>

              <div className="space-y-1">
                <Label>Approval status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as LumaApprovalStatus | "all")}
                  disabled={isParsing || isSending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="invited">invited</SelectItem>
                    <SelectItem value="pending_approval">pending_approval</SelectItem>
                    <SelectItem value="declined">declined</SelectItem>
                    <SelectItem value="unknown">unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-selected"
                    checked={showOnlySelected}
                    onCheckedChange={(checked) => setShowOnlySelected(Boolean(checked))}
                    disabled={isParsing || isSending}
                  />
                  <Label htmlFor="only-selected">Only selected</Label>
                </div>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllVisibleSelection(true)}
                  disabled={filteredRows.length === 0 || isSending || isParsing}
                >
                  Select all (visible)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllVisibleSelection(false)}
                  disabled={filteredRows.length === 0 || isSending || isParsing}
                >
                  Select none (visible)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeDuplicates}
                  disabled={stats.duplicates === 0 || isSending || isParsing}
                >
                  Remove duplicates
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeInvalidRows}
                  disabled={stats.invalid === 0 || isSending || isParsing}
                >
                  Remove invalid
                </Button>
              </div>

              <Button
                type="button"
                onClick={() => void sendInvites()}
                disabled={isSending || isParsing || selectedValidRows.length === 0}
              >
                {isSending ? "Sending..." : `Send invitations (${selectedValidRows.length})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">
                      <Checkbox
                        checked={headerCheckboxState.checked}
                        // shadcn Checkbox supports "indeterminate" via "checked" = "indeterminate"
                        // but the component typing usually allows boolean only. We simulate it by letting the UI be driven by row state.
                        onCheckedChange={(checked) => setAllVisibleSelection(Boolean(checked))}
                        aria-label="Select all visible rows"
                      />
                    </TableHead>
                    <TableHead className="w-[70px]">Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Checked in</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No rows match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell>
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={(checked) => {
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.rowNumber === r.rowNumber ? { ...x, selected: Boolean(checked) } : x
                                )
                              );
                            }}
                            disabled={r.validation !== "valid" || isSending || isParsing}
                            aria-label={`Select row ${r.rowNumber}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{r.approvalStatus}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.email || <span className="text-red-600">missing</span>}</TableCell>
                        <TableCell>{r.ticketName || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.checkedInAt || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.validation === "valid" ? (
                            <span className="text-green-700">valid</span>
                          ) : (
                            <span className="text-red-700">{r.validation}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Small UX note: we intentionally disable selecting invalid rows so emails can’t be sent accidentally */}
            {stats.invalid > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Invalid rows are not selectable. Use “Remove invalid” to clean them up.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


