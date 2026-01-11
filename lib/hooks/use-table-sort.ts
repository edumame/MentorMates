import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig<T extends string> {
  field: T;
  direction: SortDirection;
}

export interface UseTableSortOptions<T extends string> {
  defaultField: T;
  defaultDirection?: SortDirection;
}

export interface UseTableSortReturn<T extends string, D> {
  sortConfig: SortConfig<T>;
  sortedData: D[];
  handleSort: (field: T) => void;
  getSortDirection: (field: T) => SortDirection | null;
}

/**
 * A generic hook for sorting table data
 *
 * @param data - The array of data to sort
 * @param options - Configuration options including default field and direction
 * @param sortFn - A function that compares two items based on the sort field
 * @returns Sort state and helpers for managing table sorting
 *
 * @example
 * const { sortedData, handleSort, getSortDirection } = useTableSort(
 *   projects,
 *   { defaultField: "project_name" },
 *   (a, b, field) => {
 *     switch (field) {
 *       case "project_name":
 *         return (a.project_name || "").localeCompare(b.project_name || "");
 *       case "created_at":
 *         return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
 *       default:
 *         return 0;
 *     }
 *   }
 * );
 */
export function useTableSort<T extends string, D>(
  data: D[],
  options: UseTableSortOptions<T>,
  sortFn: (a: D, b: D, field: T) => number
): UseTableSortReturn<T, D> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    field: options.defaultField,
    direction: options.defaultDirection ?? "asc",
  });

  const handleSort = useCallback((field: T) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const getSortDirection = useCallback(
    (field: T): SortDirection | null => {
      return sortConfig.field === field ? sortConfig.direction : null;
    },
    [sortConfig]
  );

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const comparison = sortFn(a, b, sortConfig.field);
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig, sortFn]);

  return {
    sortConfig,
    sortedData,
    handleSort,
    getSortDirection,
  };
}
