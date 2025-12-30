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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { ParsedRowWithValidation, CSVParseResult } from "../types";

interface ImportPreviewTableProps {
  parseResult: CSVParseResult;
  selectedRows: Set<number>;
  onSelectionChange: (selectedRows: Set<number>) => void;
  onRemoveRow: (rowIndex: number) => void;
  pageSize?: number;
}

export function ImportPreviewTable({
  parseResult,
  selectedRows,
  onSelectionChange,
  onRemoveRow,
  pageSize = 20,
}: ImportPreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(parseResult.rows.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, parseResult.rows.length);
  const currentRows = parseResult.rows.slice(startIndex, endIndex);

  const validRowIndices = parseResult.rows
    .filter((row) => row.validation.isValid && !row.isDuplicate)
    .map((row) => row.rowIndex);

  const allCurrentValidSelected = currentRows
    .filter((row) => row.validation.isValid && !row.isDuplicate)
    .every((row) => selectedRows.has(row.rowIndex));

  const handleSelectAll = () => {
    if (allCurrentValidSelected) {
      // Deselect all current valid rows
      const newSelection = new Set(selectedRows);
      currentRows.forEach((row) => {
        if (row.validation.isValid && !row.isDuplicate) {
          newSelection.delete(row.rowIndex);
        }
      });
      onSelectionChange(newSelection);
    } else {
      // Select all current valid rows
      const newSelection = new Set(selectedRows);
      currentRows.forEach((row) => {
        if (row.validation.isValid && !row.isDuplicate) {
          newSelection.add(row.rowIndex);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const handleSelectRow = (rowIndex: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    onSelectionChange(newSelection);
  };

  const getRowStatus = (row: ParsedRowWithValidation) => {
    if (!row.validation.isValid) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-destructive" />,
        label: "Error",
        variant: "destructive" as const,
      };
    }
    if (row.isDuplicate) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        label: "Duplicate",
        variant: "outline" as const,
      };
    }
    if (row.existsInDatabase) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        label: "Exists",
        variant: "outline" as const,
      };
    }
    if (row.validation.warnings.length > 0) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        label: "Warning",
        variant: "outline" as const,
      };
    }
    return {
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      label: "Valid",
      variant: "secondary" as const,
    };
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">
          {parseResult.totalRows} total rows
        </span>
        <span className="text-green-600">
          {parseResult.validRows} valid
        </span>
        {parseResult.invalidRows > 0 && (
          <span className="text-destructive">
            {parseResult.invalidRows} invalid
          </span>
        )}
        {parseResult.duplicateRows > 0 && (
          <span className="text-amber-600">
            {parseResult.duplicateRows} duplicates
          </span>
        )}
        <span className="text-muted-foreground">
          {selectedRows.size} selected
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allCurrentValidSelected && currentRows.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.map((row) => {
              const status = getRowStatus(row);
              const isSelectable =
                row.validation.isValid && !row.isDuplicate && !row.existsInDatabase;

              return (
                <TableRow
                  key={row.rowIndex}
                  className={cn(
                    !row.validation.isValid && "bg-destructive/5",
                    row.isDuplicate && "bg-amber-50",
                    row.existsInDatabase && "bg-amber-50"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(row.rowIndex)}
                      onCheckedChange={() => handleSelectRow(row.rowIndex)}
                      disabled={!isSelectable}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {status.icon}
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.data.email}
                  </TableCell>
                  <TableCell>
                    {row.data.name ||
                      [row.data.first_name, row.data.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.data.phone_number || "-"}
                  </TableCell>
                  <TableCell>
                    {row.validation.errors.length > 0 && (
                      <span className="text-xs text-destructive">
                        {row.validation.errors[0]}
                      </span>
                    )}
                    {row.validation.warnings.length > 0 &&
                      row.validation.errors.length === 0 && (
                        <span className="text-xs text-amber-600">
                          {row.validation.warnings[0]}
                        </span>
                      )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRow(row.rowIndex)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{endIndex} of {parseResult.rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

