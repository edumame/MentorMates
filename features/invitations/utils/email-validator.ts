/**
 * Email validation utilities for invitation imports
 */

// Standard email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// More strict email regex for better validation
const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable email domains to warn about
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.com',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
]);

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  normalizedEmail: string;
  errors: string[];
  warnings: string[];
}

/**
 * Normalize email address (lowercase, trim whitespace)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate a single email address
 */
export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Normalize the email
  const normalizedEmail = normalizeEmail(email);
  
  // Check if empty
  if (!normalizedEmail) {
    errors.push('Email address is required');
    return {
      isValid: false,
      email,
      normalizedEmail,
      errors,
      warnings,
    };
  }
  
  // Check basic format
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    errors.push('Invalid email format');
    return {
      isValid: false,
      email,
      normalizedEmail,
      errors,
      warnings,
    };
  }
  
  // Check strict format
  if (!STRICT_EMAIL_REGEX.test(normalizedEmail)) {
    warnings.push('Email format may have issues with some mail servers');
  }
  
  // Check for common typos in domain
  const domain = normalizedEmail.split('@')[1];
  if (domain) {
    // Check for disposable email domains
    if (DISPOSABLE_DOMAINS.has(domain)) {
      warnings.push('This appears to be a disposable email address');
    }
    
    // Check for common domain typos
    const typoWarnings = checkCommonDomainTypos(domain);
    warnings.push(...typoWarnings);
  }
  
  // Check for unusual characters that might cause issues
  if (normalizedEmail.includes('..')) {
    errors.push('Email contains consecutive dots');
  }
  
  if (normalizedEmail.startsWith('.') || normalizedEmail.includes('.@')) {
    errors.push('Email has invalid dot placement');
  }
  
  return {
    isValid: errors.length === 0,
    email,
    normalizedEmail,
    errors,
    warnings,
  };
}

/**
 * Check for common domain typos
 */
function checkCommonDomainTypos(domain: string): string[] {
  const warnings: string[] = [];
  
  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com',
  };
  
  if (commonTypos[domain]) {
    warnings.push(`Did you mean ${commonTypos[domain]}?`);
  }
  
  return warnings;
}

/**
 * Validate multiple emails and find duplicates
 */
export function validateEmails(emails: string[]): {
  results: EmailValidationResult[];
  duplicates: Set<string>;
} {
  const results: EmailValidationResult[] = [];
  const seenEmails = new Set<string>();
  const duplicates = new Set<string>();
  
  for (const email of emails) {
    const result = validateEmail(email);
    
    // Check for duplicates
    if (seenEmails.has(result.normalizedEmail)) {
      duplicates.add(result.normalizedEmail);
    } else {
      seenEmails.add(result.normalizedEmail);
    }
    
    results.push(result);
  }
  
  return { results, duplicates };
}

/**
 * Extract email from a string that might contain name and email
 * e.g., "John Doe <john@example.com>" -> "john@example.com"
 */
export function extractEmail(input: string): string {
  // Check for angle bracket format
  const angleMatch = input.match(/<([^>]+)>/);
  if (angleMatch) {
    return angleMatch[1].trim();
  }
  
  // Check for parenthesis format
  const parenMatch = input.match(/\(([^)]+)\)/);
  if (parenMatch && EMAIL_REGEX.test(parenMatch[1].trim())) {
    return parenMatch[1].trim();
  }
  
  // Return as-is if it looks like an email
  return input.trim();
}

