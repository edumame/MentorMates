/**
 * Luma-specific CSV adapter
 * Handles parsing and transforming Luma CSV exports into invitation records
 */

import { parseCSVContent, detectDelimiter, normalizeHeader } from './csv-parser';
import { validateEmail, normalizeEmail } from './email-validator';
import type {
  LumaCSVRow,
  ParsedInvitation,
  ParsedRowWithValidation,
  CSVParseResult,
  LumaSourceMetadata,
} from '../types';
import { InvitationSource } from '../types';

// Known Luma CSV column headers with their normalized versions
const LUMA_COLUMN_MAP: Record<string, keyof LumaCSVRow> = {
  'api_id': 'api_id',
  'name': 'name',
  'first_name': 'first_name',
  'last_name': 'last_name',
  'email': 'email',
  'phone_number': 'phone_number',
  'created_at': 'created_at',
  'approval_status': 'approval_status',
  'checked_in_at': 'checked_in_at',
  'custom_source': 'custom_source',
  'qr_code_url': 'qr_code_url',
  'amount': 'amount',
  'amount_tax': 'amount_tax',
  'amount_discount': 'amount_discount',
  'currency': 'currency',
  'coupon_code': 'coupon_code',
  'eth_address': 'eth_address',
  'solana_address': 'solana_address',
  'survey_response_rating': 'survey_response_rating',
  'survey_response_feedback': 'survey_response_feedback',
  'ticket_type_id': 'ticket_type_id',
  'ticket_name': 'ticket_name',
};

// Required columns for a valid Luma import
const REQUIRED_COLUMNS = ['email'];

// Luma approval statuses
export const LUMA_STATUS = {
  APPROVED: 'approved',
  PENDING_APPROVAL: 'pending_approval',
  DECLINED: 'declined',
  INVITED: 'invited',
} as const;

/**
 * Check if CSV appears to be a Luma export based on headers
 */
export function isLumaCSV(headers: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeHeader);
  
  // Luma CSVs typically have these distinctive columns
  const lumaIndicators = ['api_id', 'approval_status', 'qr_code_url', 'ticket_type_id'];
  const matchCount = lumaIndicators.filter(indicator => 
    normalizedHeaders.includes(normalizeHeader(indicator))
  ).length;
  
  // If we find at least 2 Luma-specific columns, it's likely a Luma CSV
  return matchCount >= 2;
}

/**
 * Map CSV headers to Luma column names
 */
export function mapLumaColumns(headers: string[]): Map<string, number> {
  const columnMap = new Map<string, number>();
  
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized in LUMA_COLUMN_MAP) {
      columnMap.set(LUMA_COLUMN_MAP[normalized], index);
    }
  });
  
  return columnMap;
}

/**
 * Parse a row into a LumaCSVRow object
 */
function parseRowToLumaCSVRow(row: Record<string, string>): Partial<LumaCSVRow> {
  const result: Partial<LumaCSVRow> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedKey in LUMA_COLUMN_MAP) {
      const lumaKey = LUMA_COLUMN_MAP[normalizedKey];
      result[lumaKey] = value;
    }
  }
  
  return result;
}

/**
 * Transform a Luma CSV row into a ParsedInvitation
 */
export function transformLumaRow(row: Partial<LumaCSVRow>): ParsedInvitation {
  // Build display name from available fields
  let name: string | null = null;
  if (row.name && row.name.trim()) {
    name = row.name.trim();
  } else if (row.first_name || row.last_name) {
    name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
  }
  
  // Build source metadata
  const sourceMetadata: LumaSourceMetadata = {
    luma_id: row.api_id || undefined,
    luma_created_at: row.created_at || undefined,
    luma_qr_code_url: row.qr_code_url || undefined,
    luma_ticket_type_id: row.ticket_type_id || undefined,
    luma_ticket_name: row.ticket_name || undefined,
    luma_checked_in_at: row.checked_in_at || undefined,
    original_row: row as Record<string, string>,
  };
  
  return {
    email: normalizeEmail(row.email || ''),
    name,
    first_name: row.first_name?.trim() || null,
    last_name: row.last_name?.trim() || null,
    phone_number: row.phone_number?.trim() || null,
    luma_status: row.approval_status || null,
    source_metadata: sourceMetadata,
  };
}

/**
 * Validate a parsed invitation row
 */
export function validateInvitationRow(
  invitation: ParsedInvitation,
  rowIndex: number,
  seenEmails: Set<string>,
  existingEmails: Set<string>
): ParsedRowWithValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate email
  const emailValidation = validateEmail(invitation.email);
  errors.push(...emailValidation.errors);
  warnings.push(...emailValidation.warnings);
  
  // Check for duplicates within the import
  const isDuplicate = seenEmails.has(emailValidation.normalizedEmail);
  if (isDuplicate) {
    warnings.push('Duplicate email in import file');
  }
  
  // Check if already exists in database
  const existsInDatabase = existingEmails.has(emailValidation.normalizedEmail);
  if (existsInDatabase) {
    warnings.push('Email already has a pending or sent invitation');
  }
  
  // Validate Luma status
  if (invitation.luma_status === LUMA_STATUS.DECLINED) {
    warnings.push('This participant was declined in Luma');
  }
  
  // Check for missing name
  if (!invitation.name && !invitation.first_name && !invitation.last_name) {
    warnings.push('No name provided - email prefix will be used');
  }
  
  return {
    rowIndex,
    data: {
      ...invitation,
      email: emailValidation.normalizedEmail,
    },
    validation: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
    isDuplicate,
    existsInDatabase,
  };
}

/**
 * Parse a complete Luma CSV file
 */
export function parseLumaCSV(
  content: string,
  existingEmails: Set<string> = new Set()
): CSVParseResult {
  const errors: string[] = [];
  
  // Detect delimiter
  const delimiter = detectDelimiter(content);
  
  // Parse CSV content
  const rawResult = parseCSVContent(content, { delimiter });
  
  if (rawResult.errors.length > 0) {
    errors.push(...rawResult.errors);
  }
  
  if (rawResult.rows.length === 0) {
    return {
      success: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      errors: ['No data rows found in CSV'],
      detectedColumns: rawResult.headers,
    };
  }
  
  // Check for required columns
  const normalizedHeaders = rawResult.headers.map(normalizeHeader);
  for (const required of REQUIRED_COLUMNS) {
    if (!normalizedHeaders.includes(normalizeHeader(required))) {
      errors.push(`Missing required column: ${required}`);
    }
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      rows: [],
      totalRows: rawResult.rowCount,
      validRows: 0,
      invalidRows: rawResult.rowCount,
      duplicateRows: 0,
      errors,
      detectedColumns: rawResult.headers,
    };
  }
  
  // Transform and validate each row
  const seenEmails = new Set<string>();
  const parsedRows: ParsedRowWithValidation[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  
  for (let i = 0; i < rawResult.rows.length; i++) {
    const rawRow = rawResult.rows[i];
    const lumaRow = parseRowToLumaCSVRow(rawRow);
    const invitation = transformLumaRow(lumaRow);
    
    const validatedRow = validateInvitationRow(
      invitation,
      i,
      seenEmails,
      existingEmails
    );
    
    // Track seen emails for duplicate detection
    if (validatedRow.data.email) {
      seenEmails.add(validatedRow.data.email);
    }
    
    // Count statistics
    if (validatedRow.validation.isValid) {
      validRows++;
    } else {
      invalidRows++;
    }
    
    if (validatedRow.isDuplicate) {
      duplicateRows++;
    }
    
    parsedRows.push(validatedRow);
  }
  
  return {
    success: errors.length === 0 && validRows > 0,
    rows: parsedRows,
    totalRows: rawResult.rowCount,
    validRows,
    invalidRows,
    duplicateRows,
    errors,
    detectedColumns: rawResult.headers,
  };
}

/**
 * Filter rows to only include valid, non-duplicate entries
 */
export function getImportableRows(
  parseResult: CSVParseResult,
  includeExisting: boolean = false
): ParsedRowWithValidation[] {
  return parseResult.rows.filter(row => {
    if (!row.validation.isValid) return false;
    if (row.isDuplicate) return false;
    if (!includeExisting && row.existsInDatabase) return false;
    return true;
  });
}

/**
 * Get invitation source based on CSV type detection
 */
export function detectInvitationSource(headers: string[]): typeof InvitationSource[keyof typeof InvitationSource] {
  if (isLumaCSV(headers)) {
    return InvitationSource.LUMA_IMPORT;
  }
  return InvitationSource.CSV_IMPORT;
}

