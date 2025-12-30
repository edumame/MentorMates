"use client";

import { useState, useCallback } from "react";
import { parseLumaCSV } from "../utils/luma-csv-adapter";
import { readFileAsText } from "../utils/csv-parser";
import type { CSVParseResult } from "../types";

interface UseCSVParserReturn {
  parseResult: CSVParseResult | null;
  isLoading: boolean;
  error: string | null;
  parseFile: (file: File, existingEmails?: Set<string>) => Promise<CSVParseResult | null>;
  reset: () => void;
}

export function useCSVParser(): UseCSVParserReturn {
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(
    async (
      file: File,
      existingEmails: Set<string> = new Set()
    ): Promise<CSVParseResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Read file content
        const content = await readFileAsText(file);

        if (!content || content.trim() === "") {
          setError("File is empty");
          setIsLoading(false);
          return null;
        }

        // Parse CSV
        const result = parseLumaCSV(content, existingEmails);

        if (!result.success && result.errors.length > 0) {
          setError(result.errors[0]);
        }

        setParseResult(result);
        setIsLoading(false);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to parse CSV file";
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setParseResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    parseResult,
    isLoading,
    error,
    parseFile,
    reset,
  };
}

