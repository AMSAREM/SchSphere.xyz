/**
 * Comprehensive Email Verification & Typo Detection Utility
 * Validates RFC 5322 compliance, Top-Level Domain (TLD) structure, common provider typos,
 * and performs live DNS MX server validation via backend.
 */

// Common domain typos dictionary
const DOMAIN_TYPO_MAP: Record<string, string> = {
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co.uk': 'yahoo.co.uk',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'iclou.com': 'icloud.com',
};

// Strict RFC 5322 compliant regex with proper domain label and TLD enforcement
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  domain?: string;
  isMxChecked?: boolean;
}

/**
 * Validates the syntax, domain, and common typos of an email address client-side.
 */
export function validateEmailSyntax(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email address cannot be empty.' };
  }

  const clean = email.trim().toLowerCase();

  if (clean.length > 254) {
    return { isValid: false, error: 'Email address exceeds maximum length of 254 characters.' };
  }

  if (clean.includes('..')) {
    return { isValid: false, error: 'Email contains invalid consecutive dots (..).' };
  }

  if (!clean.includes('@')) {
    return { isValid: false, error: 'Missing "@" symbol in email address.' };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Email must contain exactly one "@" symbol.' };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length === 0) {
    return { isValid: false, error: 'Email username prefix cannot be empty.' };
  }

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email username prefix exceeds 64 characters.' };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, error: 'Email username cannot start or end with a dot.' };
  }

  if (!domainPart || domainPart.length === 0) {
    return { isValid: false, error: 'Missing domain part after "@".' };
  }

  if (!domainPart.includes('.')) {
    return { isValid: false, error: `Domain "${domainPart}" is missing an extension (e.g., .com, .edu.gh).` };
  }

  const domainParts = domainPart.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { isValid: false, error: `Invalid domain extension ".${tld}". Top-level domains must contain at least 2 alphabetic characters.` };
  }

  if (!EMAIL_REGEX.test(clean)) {
    return { isValid: false, error: 'Email format does not adhere to standard RFC 5322 format.' };
  }

  // Check common typos
  let suggestion: string | undefined;
  if (DOMAIN_TYPO_MAP[domainPart]) {
    const fixedDomain = DOMAIN_TYPO_MAP[domainPart];
    suggestion = `${localPart}@${fixedDomain}`;
  }

  return {
    isValid: true,
    domain: domainPart,
    suggestion
  };
}

/**
 * Deep-verify email by contacting the backend to test DNS MX mail server records.
 */
export async function verifyEmailWithBackend(email: string): Promise<EmailValidationResult> {
  const syntax = validateEmailSyntax(email);
  if (!syntax.isValid) {
    return syntax;
  }

  try {
    const res = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        isValid: data.isValid,
        error: data.error || (data.isValid ? undefined : 'Domain does not have active mail servers.'),
        suggestion: data.suggestion || syntax.suggestion,
        domain: data.domain || syntax.domain,
        isMxChecked: true
      };
    }
  } catch (e) {
    // If offline or network issue, fallback to syntax result
    console.warn('Backend email verification unreachable, using syntax result:', e);
  }

  return {
    ...syntax,
    isMxChecked: false
  };
}
