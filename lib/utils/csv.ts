import Papa from "papaparse";

/**
 * Serialises rows to CSV for organizer exports that are opened in Excel /
 * Google Sheets. Cells come from user-controlled data (display names,
 * affiliations, project names, form answers), so any text cell that a
 * spreadsheet could treat as a formula is prefixed with a single quote
 * (ORG-001). Always use this instead of calling Papa.unparse directly.
 *
 * papaparse's own `escapeFormulae` is not used: its regex has no dotAll flag,
 * so multi-line cells such as '=HYPERLINK(..)\nhi' slipped through.
 */

// First non-space character is a formula trigger, or the cell starts with a
// tab / carriage return / line feed (spreadsheets strip those before parsing).
const FORMULA_START = /^(?:[\t\r\n]|[  ]*[=+\-@])/;

export function neutralizeSpreadsheetFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function sanitizeCell(value: unknown): unknown {
  return typeof value === "string" ? neutralizeSpreadsheetFormula(value) : value;
}

type CsvInput = Array<Record<string, unknown>> | unknown[][];

export function toSpreadsheetSafeCsv(data: CsvInput): string {
  const rows = (data as unknown[]).map((row) =>
    Array.isArray(row)
      ? row.map(sanitizeCell)
      : Object.fromEntries(
          Object.entries(row as Record<string, unknown>).map(([key, value]) => [
            key,
            sanitizeCell(value),
          ])
        )
  );
  return Papa.unparse(rows as Parameters<typeof Papa.unparse>[0]);
}
