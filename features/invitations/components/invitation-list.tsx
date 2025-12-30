"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvitationStatusBadge } from "./invitation-status-badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import type { EventInvitation, InvitationStats } from "../types";
import { InvitationStatus } from "../types";

interface InvitationListProps {
  invitations: EventInvitation[];
  stats: InvitationStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onPageChange: (page: number) => void;
  onStatusFilter: (status: string | undefined) => void;
  onSearchChange: (search: string) => void;
  onResend: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  currentStatusFilter?: string;
  currentSearch?: string;
}

export function InvitationList({
  invitations,
  stats,
  pagination,
  selectedIds,
  onSelectionChange,
  onPageChange,
  onStatusFilter,
  onSearchChange,
  onResend,
  onDelete,
  isLoading = false,
  currentStatusFilter,
  currentSearch = "",
}: InvitationListProps) {
  const [searchInput, setSearchInput] = useState(currentSearch);

  const allSelected =
    invitations.length > 0 &&
    invitations.every((inv) => selectedIds.has(inv.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(invitations.map((inv) => inv.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchInput);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canResend = (status: string) => {
    return [
      InvitationStatus.SENT,
      InvitationStatus.EXPIRED,
      InvitationStatus.BOUNCED,
    ].includes(status as typeof InvitationStatus[keyof typeof InvitationStatus]);
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard
          label="Pending"
          value={stats.pending}
          className="text-gray-600"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          className="text-blue-600"
        />
        <StatCard
          label="Sent"
          value={stats.sent}
          className="text-indigo-600"
        />
        <StatCard
          label="Accepted"
          value={stats.accepted}
          className="text-green-600"
        />
        <StatCard
          label="Expired"
          value={stats.expired}
          className="text-amber-600"
        />
        <StatCard
          label="Bounced"
          value={stats.bounced}
          className="text-red-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Select
          value={currentStatusFilter || "all"}
          onValueChange={(value) =>
            onStatusFilter(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={invitations.length === 0}
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : invitations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  No invitations found
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(invitation.id)}
                      onCheckedChange={() => handleSelectRow(invitation.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {invitation.email}
                  </TableCell>
                  <TableCell>
                    {invitation.name ||
                      [invitation.first_name, invitation.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      "-"}
                  </TableCell>
                  <TableCell>
                    <InvitationStatusBadge
                      status={invitation.status}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {invitation.source.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(invitation.sent_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canResend(invitation.status) && (
                          <DropdownMenuItem
                            onClick={() => onResend(invitation.id)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Resend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDelete(invitation.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <p className={cn("text-2xl font-bold", className)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

