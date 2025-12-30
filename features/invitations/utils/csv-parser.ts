/**
 * Generic CSV parser utility
 * Handles parsing, encoding detection, and column mapping
 */

export interface CSVParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: BufferEncoding;
  skipEmptyLines?: boolean;
  trimValues?: boolean;
}

export interface CSVColumn {
  index: number;
  header: string;
  normalizedHeader: string;
}

export interface RawCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: string[];
}

const DEFAULT_OPTIONS: CSVParseOptions = {
  delimiter: ',',
  hasHeader: true,
  encoding: 'utf-8',
  skipEmptyLines: true,
  trimValues: true,
};

/**
 * Parse CSV content string into structured data
 */
export function parseCSVContent(
  content: string,
  options: CSVParseOptions = {}
): RawCSVResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  
  // Split into lines, handling different line endings
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0, errors: ['Empty CSV file'] };
  }
  
  // Parse headers
  let headers: string[] = [];
  let dataStartIndex = 0;
  
  if (opts.hasHeader) {
    headers = parseCSVLine(lines[0], opts.delimiter!);
    if (opts.trimValues) {
      headers = headers.map(h => h.trim());
    }
    dataStartIndex = 1;
  }
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines if configured
    if (opts.skipEmptyLines && (!line || line.trim() === '')) {
      continue;
    }
    
    try {
      const values = parseCSVLine(line, opts.delimiter!);
      
      if (opts.trimValues) {
        values.forEach((v, idx) => {
          values[idx] = v.trim();
        });
      }
      
      // Create row object
      const row: Record<string, string> = {};
      
      if (opts.hasHeader) {
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
      } else {
        values.forEach((value, idx) => {
          row[`column_${idx}`] = value;
        });
      }
      
      rows.push(row);
    } catch (error) {
      errors.push(`Error parsing line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    headers,
    rows,
    rowCount: rows.length,
    errors,
  };
}

/**
 * Parse a single CSV line, handling quoted values and escaped quotes
 */
export function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted section
          inQuotes = false;
          i++;
          continue;
        }
      }
      current += char;
    } else {
      if (char === '"') {
        // Start of quoted section
        inQuotes = true;
      } else if (char === delimiter) {
        // End of field
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    i++;
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}

/**
 * Detect CSV delimiter from content
 */
export function detectDelimiter(content: string): string {
  const firstLine = content.split(/[\r\n]/)[0];
  
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  for (const delimiter of delimiters) {
    // Count occurrences outside quotes
    let count = 0;
    let inQuotes = false;
    
    for (const char of firstLine) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === delimiter) {
        count++;
      }
    }
    
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }
  
  return detectedDelimiter;
}

/**
 * Try to detect file encoding from content
 * Returns detected encoding or null if detection fails
 */
export function detectEncoding(buffer: ArrayBuffer): BufferEncoding {
  const bytes = new Uint8Array(buffer);
  
  // Check for BOM (Byte Order Mark)
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8';
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'utf16le';
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'utf16le'; // We'll handle BE as LE for simplicity
  }
  
  // Default to UTF-8
  return 'utf-8';
}

/**
 * Normalize column header for matching
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Find matching column index for a set of possible header names
 */
export function findColumnIndex(
  headers: string[],
  possibleNames: string[]
): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedNames = possibleNames.map(normalizeHeader);
  
  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (normalizedNames.includes(normalizedHeaders[i])) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Read file as text with encoding detection
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const encoding = detectEncoding(buffer);
      const decoder = new TextDecoder(encoding);
      resolve(decoder.decode(buffer));
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

