"use client";

import { useState, useCallback } from "react";
import type {
  EventInvitation,
  InvitationStats,
  InvitationFilters,
  ParsedInvitation,
  ImportResponse,
} from "../types";

interface UseInvitationsReturn {
  invitations: EventInvitation[];
  stats: InvitationStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
  fetchInvitations: (eventId: string, filters?: InvitationFilters) => Promise<void>;
  importInvitations: (
    eventId: string,
    invitations: ParsedInvitation[],
    source: string
  ) => Promise<ImportResponse | null>;
  approveInvitations: (
    eventId: string,
    invitationIds: string[],
    approveAll?: boolean
  ) => Promise<boolean>;
  sendInvitations: (
    eventId: string,
    invitationIds?: string[],
    sendAll?: boolean,
    customMessage?: string
  ) => Promise<boolean>;
  resendInvitation: (eventId: string, invitationId: string) => Promise<boolean>;
  deleteInvitation: (eventId: string, invitationId: string) => Promise<boolean>;
  createInvitation: (
    eventId: string,
    invitation: Partial<ParsedInvitation>
  ) => Promise<EventInvitation | null>;
}

const defaultStats: InvitationStats = {
  total: 0,
  pending: 0,
  approved: 0,
  sent: 0,
  accepted: 0,
  expired: 0,
  bounced: 0,
  declined: 0,
};

const defaultPagination = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export function useInvitations(): UseInvitationsReturn {
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [stats, setStats] = useState<InvitationStats>(defaultStats);
  const [pagination, setPagination] = useState(defaultPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(
    async (eventId: string, filters?: InvitationFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters?.status?.length) {
          params.set("status", filters.status.join(","));
        }
        if (filters?.source?.length) {
          params.set("source", filters.source.join(","));
        }
        if (filters?.search) {
          params.set("search", filters.search);
        }
        if (filters?.page) {
          params.set("page", filters.page.toString());
        }
        if (filters?.limit) {
          params.set("limit", filters.limit.toString());
        }

        const response = await fetch(
          `/api/events/${eventId}/invitations?${params.toString()}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch invitations");
        }

        const data = await response.json();
        setInvitations(data.invitations);
        setStats(data.stats);
        setPagination(data.pagination);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch invitations";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const importInvitations = useCallback(
    async (
      eventId: string,
      invitationsToImport: ParsedInvitation[],
      source: string
    ): Promise<ImportResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert invitations to CSV-like format for the API
        const csvLines = [
          "email,name,first_name,last_name,phone_number",
          ...invitationsToImport.map(
            (inv) =>
              `${inv.email},${inv.name || ""},${inv.first_name || ""},${inv.last_name || ""},${inv.phone_number || ""}`
          ),
        ];
        const csvContent = csvLines.join("\n");

        const response = await fetch(
          `/api/events/${eventId}/invitations/import`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ csvContent }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to import invitations");
        }

        const data: ImportResponse = await response.json();
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to import invitations";
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const approveInvitations = useCallback(
    async (
      eventId: string,
      invitationIds: string[],
      approveAll: boolean = false
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/events/${eventId}/invitations/approve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ invitationIds, approveAll }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to approve invitations");
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to approve invitations";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const sendInvitations = useCallback(
    async (
      eventId: string,
      invitationIds?: string[],
      sendAll: boolean = false,
      customMessage?: string
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/events/${eventId}/invitations/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invitationIds, sendAll, customMessage }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to send invitations");
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send invitations";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resendInvitation = useCallback(
    async (eventId: string, invitationId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/events/${eventId}/invitations/${invitationId}/resend`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to resend invitation");
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to resend invitation";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteInvitation = useCallback(
    async (eventId: string, invitationId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/events/${eventId}/invitations/${invitationId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete invitation");
        }

        // Remove from local state
        setInvitations((prev) =>
          prev.filter((inv) => inv.id !== invitationId)
        );

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete invitation";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const createInvitation = useCallback(
    async (
      eventId: string,
      invitation: Partial<ParsedInvitation>
    ): Promise<EventInvitation | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/events/${eventId}/invitations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invitation),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create invitation");
        }

        const data = await response.json();
        return data.invitation;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create invitation";
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    invitations,
    stats,
    pagination,
    isLoading,
    error,
    fetchInvitations,
    importInvitations,
    approveInvitations,
    sendInvitations,
    resendInvitation,
    deleteInvitation,
    createInvitation,
  };
}

