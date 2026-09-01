/**
 * File Security & Duplicate Prevention Module
 * Prevents importing duplicated files by calculating cryptographic checksums (SHA-256),
 * content fingerprinting, and maintaining an audit log of imported files per school tenant.
 */

export interface ImportedFileRecord {
  id?: number;
  hash: string; // SHA-256 hash of file content
  fileName: string;
  fileSize: number;
  rowCount: number;
  schoolId?: string;
  module: 'students' | 'results' | 'teachers' | 'general';
  importedAt: number; // timestamp
  importedBy?: string;
  checksumShort: string;
}

const STORAGE_KEY_PREFIX = 'school_imported_files_';

/**
 * Computes a SHA-256 hex digest of a File, Blob, or ArrayBuffer.
 */
export async function calculateFileHash(fileOrBuffer: File | Blob | ArrayBuffer | string): Promise<string> {
  try {
    let arrayBuffer: ArrayBuffer;
    
    if (typeof fileOrBuffer === 'string') {
      const encoder = new TextEncoder();
      arrayBuffer = encoder.encode(fileOrBuffer).buffer;
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    }

    if (window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      // Fallback deterministic polynomial rolling hash if crypto.subtle is unavailable
      const bytes = new Uint8Array(arrayBuffer);
      let h1 = 0xdeadbeef ^ bytes.length;
      let h2 = 0x41c6ce57 ^ bytes.length;
      for (let i = 0; i < bytes.length; i++) {
        const ch = bytes[i];
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
      h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
      h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return `fallback_${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
    }
  } catch (e) {
    console.warn('Notice computing file hash:', e);
    // Secondary fallback based on file content length and pseudo-random stamp
    return `hash_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Calculates a content signature based on normalized JSON row objects.
 * Useful to detect identical data even if Excel was re-saved with new timestamp metadata.
 */
export async function calculateContentFingerprint(rows: any[]): Promise<string> {
  try {
    if (!rows || rows.length === 0) return 'empty_dataset';
    
    // Pick first 50 rows and create a deterministic string
    const sample = rows.slice(0, 100).map(r => {
      const copy: any = {};
      Object.keys(r).sort().forEach(k => {
        if (k !== 'id' && k !== 'createdAt' && k !== 'created_at') {
          copy[k] = r[k];
        }
      });
      return copy;
    });

    const str = JSON.stringify(sample);
    return await calculateFileHash(str);
  } catch (e) {
    return `content_${rows.length}`;
  }
}

/**
 * Checks whether this file or content has already been imported for the school.
 */
export async function checkIsFileDuplicate(
  hash: string,
  contentFingerprint?: string,
  schoolId?: string,
  moduleName: 'students' | 'results' | 'teachers' | 'general' = 'students'
): Promise<{ isDuplicate: boolean; previousRecord?: ImportedFileRecord; reason?: string }> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${schoolId || 'global'}_${moduleName}`;
    const raw = localStorage.getItem(key);
    const existingRecords: ImportedFileRecord[] = raw ? JSON.parse(raw) : [];

    // 1. Check exact file hash match
    const exactMatch = existingRecords.find(r => r.hash === hash);
    if (exactMatch) {
      return {
        isDuplicate: true,
        previousRecord: exactMatch,
        reason: `File with identical hash was already imported on ${new Date(exactMatch.importedAt).toLocaleString()}`
      };
    }

    // 2. Check content fingerprint match if provided
    if (contentFingerprint) {
      const contentMatch = existingRecords.find(r => r.hash === contentFingerprint);
      if (contentMatch) {
        return {
          isDuplicate: true,
          previousRecord: contentMatch,
          reason: `A file containing the exact same ${contentMatch.rowCount} records was already imported on ${new Date(contentMatch.importedAt).toLocaleString()}`
        };
      }
    }

    // 3. Ask server check API
    try {
      const res = await fetch(`/api/security/check-file-hash?hash=${encodeURIComponent(hash)}&school_id=${encodeURIComponent(schoolId || '')}&module=${moduleName}`);
      if (res.ok) {
        const serverCheck = await res.json();
        if (serverCheck.isDuplicate) {
          return {
            isDuplicate: true,
            previousRecord: serverCheck.previousRecord,
            reason: serverCheck.message || 'Server verified this file has already been imported.'
          };
        }
      }
    } catch (apiErr) {
      // server check is optional fallback
    }

    return { isDuplicate: false };
  } catch (err) {
    console.warn('Error checking duplicate file:', err);
    return { isDuplicate: false };
  }
}

/**
 * Records an imported file in the security registry.
 */
export async function recordImportedFile(record: Omit<ImportedFileRecord, 'checksumShort'>): Promise<void> {
  try {
    const fullRecord: ImportedFileRecord = {
      ...record,
      checksumShort: record.hash.slice(0, 10)
    };

    const key = `${STORAGE_KEY_PREFIX}${record.schoolId || 'global'}_${record.module}`;
    const raw = localStorage.getItem(key);
    const existingRecords: ImportedFileRecord[] = raw ? JSON.parse(raw) : [];

    // Keep last 100 imported file hashes
    const updated = [fullRecord, ...existingRecords.filter(r => r.hash !== fullRecord.hash)].slice(0, 100);
    localStorage.setItem(key, JSON.stringify(updated));

    // Also register on server
    try {
      await fetch('/api/security/record-file-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullRecord)
      });
    } catch (e) {}
  } catch (err) {
    console.warn('Error recording imported file:', err);
  }
}

/**
 * Filters out duplicate student rows against an existing list of students.
 */
export function filterDuplicateStudentRows(
  newStudents: any[],
  existingStudents: any[]
): {
  uniqueStudents: any[];
  duplicateCount: number;
  duplicateIdentifiers: string[];
} {
  const existingIds = new Set<string>();
  const existingNameDob = new Set<string>();

  existingStudents.forEach(s => {
    if (s.studentId) existingIds.add(String(s.studentId).trim().toLowerCase());
    if (s.firstName && s.lastName) {
      const key = `${String(s.firstName).trim().toLowerCase()}|${String(s.lastName).trim().toLowerCase()}|${String(s.class || '').trim().toLowerCase()}`;
      existingNameDob.add(key);
    }
  });

  const uniqueStudents: any[] = [];
  const duplicateIdentifiers: string[] = [];
  const seenInBatch = new Set<string>();

  for (const s of newStudents) {
    const idKey = String(s.studentId || '').trim().toLowerCase();
    const nameKey = `${String(s.firstName || '').trim().toLowerCase()}|${String(s.lastName || '').trim().toLowerCase()}|${String(s.class || '').trim().toLowerCase()}`;

    const isDuplicate = 
      (idKey && existingIds.has(idKey)) || 
      (idKey && seenInBatch.has(idKey)) ||
      (nameKey && existingNameDob.has(nameKey)) ||
      (nameKey && seenInBatch.has(nameKey));

    if (isDuplicate) {
      duplicateIdentifiers.push(s.studentId || `${s.firstName} ${s.lastName}`);
    } else {
      if (idKey) seenInBatch.add(idKey);
      if (nameKey) seenInBatch.add(nameKey);
      uniqueStudents.push(s);
    }
  }

  return {
    uniqueStudents,
    duplicateCount: duplicateIdentifiers.length,
    duplicateIdentifiers
  };
}

/**
 * Validates that an uploaded file is strictly a CSV (.csv) file.
 * Checks file extension, MIME type, and binary header structure to reject executables and non-CSV files.
 */
export async function validateCsvFile(file: File): Promise<{ valid: boolean; error?: string; extension?: string }> {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  // 1. Strict extension check: MUST be .csv only
  const isCsv = lowerName.endsWith('.csv');

  if (!isCsv) {
    return {
      valid: false,
      error: `Invalid file format (${fileName}). Only CSV (.csv) files are allowed for imports. Excel (.xlsx / .xls) and other file types are not permitted.`
    };
  }

  const extension = 'csv';

  // 2. MIME type check
  const mime = file.type ? file.type.toLowerCase() : '';
  const validCsvMimes = [
    'text/csv',
    'application/csv',
    'text/x-csv',
    'application/x-csv',
    'text/comma-separated-values',
    'text/plain',
    'application/vnd.ms-excel', // Some legacy Windows systems tag .csv as ms-excel
    ''
  ];

  if (mime && !validCsvMimes.some(m => mime.includes(m) || m.includes(mime))) {
    return {
      valid: false,
      error: `Invalid file type (${mime || 'unknown'}). Only CSV (.csv) files are permitted for import.`
    };
  }

  // 3. Header bytes / Magic number validation to prevent executables/archives
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Reject Windows Executable (.exe, .dll) starting with "MZ"
    if (bytes.length >= 2 && bytes[0] === 0x4D && bytes[1] === 0x5A) {
      return { valid: false, error: `Security Block: Executable files are strictly forbidden.` };
    }
    // Reject ELF Linux Binaries
    if (bytes.length >= 4 && bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) {
      return { valid: false, error: `Security Block: Binary files are strictly forbidden.` };
    }
    // Reject ZIP / XLSX archives disguised as .csv (PK\x03\x04)
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return { valid: false, error: `Please upload standard CSV (.csv) text files only. Excel binary archives are not allowed.` };
    }
  } catch (e) {
    // If slice reading fails, extension check continues
  }

  return { valid: true, extension };
}

/**
 * Backward-compatible alias that enforces strict CSV (.csv) validation.
 */
export async function validateExcelOrCsvFile(file: File): Promise<{ valid: boolean; error?: string; extension?: string }> {
  return validateCsvFile(file);
}


