"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/lib/hooks/use-table-sort";

interface SortableTableHeaderProps<T extends string> {
  field: T;
  label: string;
  sortDirection: SortDirection | null;
  onSort: (field: T) => void;
  className?: string;
}

export function SortableTableHeader<T extends string>({
  field,
  label,
  sortDirection,
  onSort,
  className,
}: SortableTableHeaderProps<T>) {
  return (
    <TableHead className={className}>
      <button
        className="flex items-center hover:text-foreground"
        onClick={() => onSort(field)}
      >
        {label}
        {sortDirection === null && <ArrowUpDown className="h-4 w-4 ml-1" />}
        {sortDirection === "asc" && <ArrowUp className="h-4 w-4 ml-1" />}
        {sortDirection === "desc" && <ArrowDown className="h-4 w-4 ml-1" />}
      </button>
    </TableHead>
  );
}
