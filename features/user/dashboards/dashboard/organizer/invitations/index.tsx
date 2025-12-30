"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { Upload, Plus, CheckCircle, Send } from "lucide-react";

import {
  CSVUploadDropzone,
  ImportPreviewTable,
  InvitationList,
  EmailPreviewDialog,
} from "@/features/invitations/components";
import { useCSVParser, useInvitations } from "@/features/invitations/hooks";
import type { CSVParseResult, InvitationFilters } from "@/features/invitations/types";
import { InvitationStatus } from "@/features/invitations/types";

interface InvitationsTabProps {
  eventId: string;
  eventName: string;
}

export function InvitationsTab({ eventId, eventName }: InvitationsTabProps) {
  const { toast } = useToast();
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview">("upload");
  const [selectedImportRows, setSelectedImportRows] = useState<Set<number>>(new Set());
  
  // Email preview dialog state
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // List state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<InvitationFilters>({
    page: 1,
    limit: 50,
  });
  
  // CSV parser hook
  const {
    parseResult,
    isLoading: isParsing,
    error: parseError,
    parseFile,
    reset: resetParser,
  } = useCSVParser();
  
  // Invitations hook
  const {
    invitations,
    stats,
    pagination,
    isLoading,
    error: apiError,
    fetchInvitations,
    approveInvitations,
    sendInvitations,
    resendInvitation,
    deleteInvitation,
  } = useInvitations();

  // Fetch invitations on mount and when filters change
  useEffect(() => {
    fetchInvitations(eventId, filters);
  }, [eventId, filters, fetchInvitations]);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      // Get existing emails for duplicate detection
      const existingEmails = new Set(
        invitations.map((inv) => inv.email.toLowerCase())
      );
      
      const result = await parseFile(file, existingEmails);
      
      if (result && result.success) {
        setImportStep("preview");
        // Auto-select all valid rows
        const validIndices = result.rows
          .filter((row) => row.validation.isValid && !row.isDuplicate && !row.existsInDatabase)
          .map((row) => row.rowIndex);
        setSelectedImportRows(new Set(validIndices));
      }
    },
    [parseFile, invitations]
  );

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parseResult) return;

    const rowsToImport = parseResult.rows.filter((row) =>
      selectedImportRows.has(row.rowIndex)
    );

    if (rowsToImport.length === 0) {
      toast({
        title: "No rows selected",
        description: "Please select at least one row to import.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content from selected rows
    const csvLines = [
      "email,name,first_name,last_name,phone_number",
      ...rowsToImport.map(
        (row) =>
          `${row.data.email},"${row.data.name || ""}","${row.data.first_name || ""}","${row.data.last_name || ""}","${row.data.phone_number || ""}"`
      ),
    ];
    const csvContent = csvLines.join("\n");

    try {
      const response = await fetch(`/api/events/${eventId}/invitations/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      toast({
        title: "Import successful",
        description: `${data.imported} invitation(s) imported.`,
      });

      // Reset and close dialog
      setImportDialogOpen(false);
      setImportStep("upload");
      setSelectedImportRows(new Set());
      resetParser();

      // Refresh the list
      fetchInvitations(eventId, filters);
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [parseResult, selectedImportRows, eventId, toast, resetParser, fetchInvitations, filters]);

  // Handle remove row from preview
  const handleRemovePreviewRow = useCallback((rowIndex: number) => {
    setSelectedImportRows((prev) => {
      const next = new Set(prev);
      next.delete(rowIndex);
      return next;
    });
  }, []);

  // Handle approve selected
  const handleApproveSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No invitations selected",
        description: "Please select at least one invitation to approve.",
        variant: "destructive",
      });
      return;
    }

    const success = await approveInvitations(eventId, Array.from(selectedIds));

    if (success) {
      toast({
        title: "Invitations approved",
        description: `${selectedIds.size} invitation(s) approved.`,
      });
      setSelectedIds(new Set());
      fetchInvitations(eventId, filters);
    }
  }, [selectedIds, eventId, approveInvitations, toast, fetchInvitations, filters]);

  // Handle send selected
  const handleSendSelected = useCallback(() => {
    // Get approved invitations from selection
    const approvedSelected = invitations.filter(
      (inv) =>
        selectedIds.has(inv.id) && inv.status === InvitationStatus.APPROVED
    );

    if (approvedSelected.length === 0) {
      toast({
        title: "No approved invitations selected",
        description: "Please select approved invitations to send.",
        variant: "destructive",
      });
      return;
    }

    setEmailPreviewOpen(true);
  }, [selectedIds, invitations, toast]);

  // Handle send with custom message
  const handleSendWithMessage = useCallback(
    async (customMessage: string | null) => {
      const approvedSelectedIds = invitations
        .filter(
          (inv) =>
            selectedIds.has(inv.id) && inv.status === InvitationStatus.APPROVED
        )
        .map((inv) => inv.id);

      const success = await sendInvitations(
        eventId,
        approvedSelectedIds,
        false,
        customMessage || undefined
      );

      if (success) {
        toast({
          title: "Invitations queued",
          description: `${approvedSelectedIds.length} invitation(s) queued for sending.`,
        });
        setEmailPreviewOpen(false);
        setSelectedIds(new Set());
        fetchInvitations(eventId, filters);
      }
    },
    [selectedIds, invitations, eventId, sendInvitations, toast, fetchInvitations, filters]
  );

  // Handle resend
  const handleResend = useCallback(
    async (id: string) => {
      const success = await resendInvitation(eventId, id);

      if (success) {
        toast({
          title: "Invitation resent",
          description: "The invitation has been queued for resending.",
        });
        fetchInvitations(eventId, filters);
      }
    },
    [eventId, resendInvitation, toast, fetchInvitations, filters]
  );

  // Handle delete
  const handleDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;

    const success = await deleteInvitation(eventId, deleteTargetId);

    if (success) {
      toast({
        title: "Invitation deleted",
        description: "The invitation has been removed.",
      });
      fetchInvitations(eventId, filters);
    }

    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  }, [deleteTargetId, eventId, deleteInvitation, toast, fetchInvitations, filters]);

  // Count pending and approved
  const pendingCount = invitations.filter(
    (inv) => inv.status === InvitationStatus.PENDING
  ).length;
  const approvedCount = invitations.filter(
    (inv) => inv.status === InvitationStatus.APPROVED
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Invitations</h3>
          <p className="text-sm text-muted-foreground">
            Import participants from Luma or invite them manually
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog
            open={importDialogOpen}
            onOpenChange={(open) => {
              setImportDialogOpen(open);
              if (!open) {
                setImportStep("upload");
                setSelectedImportRows(new Set());
                resetParser();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {importStep === "upload"
                    ? "Import from CSV"
                    : "Review Import"}
                </DialogTitle>
                <DialogDescription>
                  {importStep === "upload"
                    ? "Upload a CSV file exported from Luma or another platform"
                    : "Review and select rows to import"}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-auto py-4">
                {importStep === "upload" ? (
                  <CSVUploadDropzone
                    onFileSelect={handleFileSelect}
                    isLoading={isParsing}
                    error={parseError}
                  />
                ) : parseResult ? (
                  <ImportPreviewTable
                    parseResult={parseResult}
                    selectedRows={selectedImportRows}
                    onSelectionChange={setSelectedImportRows}
                    onRemoveRow={handleRemovePreviewRow}
                  />
                ) : null}
              </div>

              {importStep === "preview" && parseResult && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportStep("upload");
                      setSelectedImportRows(new Set());
                      resetParser();
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedImportRows.size === 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Import {selectedImportRows.size} Row
                    {selectedImportRows.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
          {pendingCount > 0 && (
            <Button size="sm" onClick={handleApproveSelected}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          )}
          {approvedCount > 0 && (
            <Button size="sm" onClick={handleSendSelected}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          )}
        </div>
      )}

      {/* Error Display */}
      {apiError && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {apiError}
        </div>
      )}

      {/* Invitation List */}
      <InvitationList
        invitations={invitations}
        stats={stats}
        pagination={pagination}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onStatusFilter={(status) =>
          setFilters((prev) => ({
            ...prev,
            status: status ? [status as typeof InvitationStatus[keyof typeof InvitationStatus]] : undefined,
            page: 1,
          }))
        }
        onSearchChange={(search) =>
          setFilters((prev) => ({ ...prev, search, page: 1 }))
        }
        onResend={handleResend}
        onDelete={handleDelete}
        isLoading={isLoading}
        currentStatusFilter={filters.status?.[0]}
        currentSearch={filters.search}
      />

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        eventName={eventName}
        recipientCount={
          invitations.filter(
            (inv) =>
              selectedIds.has(inv.id) &&
              inv.status === InvitationStatus.APPROVED
          ).length
        }
        onSend={handleSendWithMessage}
        isSending={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invitation? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

