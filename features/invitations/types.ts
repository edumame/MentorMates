/**
 * Types for the invitations feature module
 * Handles Luma CSV imports and event invitation management
 */

// Invitation status enum matching database
export const InvitationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  BOUNCED: 'bounced',
  DECLINED: 'declined',
} as const;

export type InvitationStatusType = typeof InvitationStatus[keyof typeof InvitationStatus];

// Invitation source enum matching database
export const InvitationSource = {
  MANUAL: 'manual',
  LUMA_IMPORT: 'luma_import',
  CSV_IMPORT: 'csv_import',
} as const;

export type InvitationSourceType = typeof InvitationSource[keyof typeof InvitationSource];

// Database row type for event_invitations
export interface EventInvitation {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  status: InvitationStatusType;
  invite_token: string;
  source: InvitationSourceType;
  source_metadata: LumaSourceMetadata | Record<string, unknown>;
  luma_status: string | null;
  invited_by: string | null;
  custom_message: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Metadata stored from Luma CSV import
export interface LumaSourceMetadata {
  luma_id?: string;
  luma_created_at?: string;
  luma_qr_code_url?: string;
  luma_ticket_type_id?: string;
  luma_ticket_name?: string;
  luma_checked_in_at?: string;
  original_row?: Record<string, string>;
}

// Raw row from Luma CSV
export interface LumaCSVRow {
  api_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  created_at: string;
  approval_status: string;
  checked_in_at: string;
  custom_source: string;
  qr_code_url: string;
  amount: string;
  amount_tax: string;
  amount_discount: string;
  currency: string;
  coupon_code: string;
  eth_address: string;
  solana_address: string;
  survey_response_rating: string;
  survey_response_feedback: string;
  ticket_type_id: string;
  ticket_name: string;
}

// Parsed invitation ready for import
export interface ParsedInvitation {
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  luma_status: string | null;
  source_metadata: LumaSourceMetadata;
}

// Validation result for a single row
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Parsed row with validation status
export interface ParsedRowWithValidation {
  rowIndex: number;
  data: ParsedInvitation;
  validation: ValidationResult;
  isDuplicate: boolean;
  existsInDatabase: boolean;
}

// CSV parse result
export interface CSVParseResult {
  success: boolean;
  rows: ParsedRowWithValidation[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errors: string[];
  detectedColumns: string[];
}

// Import request payload
export interface ImportRequestPayload {
  invitations: ParsedInvitation[];
  source: InvitationSourceType;
}

// Import response
export interface ImportResponse {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ email: string; error: string }>;
}

// Invitation statistics for dashboard
export interface InvitationStats {
  total: number;
  pending: number;
  approved: number;
  sent: number;
  accepted: number;
  expired: number;
  bounced: number;
  declined: number;
}

// Filter options for invitation list
export interface InvitationFilters {
  status?: InvitationStatusType[];
  source?: InvitationSourceType[];
  search?: string;
  page?: number;
  limit?: number;
}

// Bulk action types
export const BulkAction = {
  APPROVE: 'approve',
  SEND: 'send',
  DELETE: 'delete',
  RESEND: 'resend',
} as const;

export type BulkActionType = typeof BulkAction[keyof typeof BulkAction];

