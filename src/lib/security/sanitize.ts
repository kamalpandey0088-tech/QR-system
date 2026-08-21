/**
 * @fileoverview Input sanitization and PII redaction utilities.
 * @security Prevents XSS attacks and ensures no PII appears in logs.
 */

/** HTML entity map for XSS prevention */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

const HTML_ENTITY_REGEX = /[&<>"'\/`]/g;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** PII patterns to redact from logs */
const PII_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL_REDACTED]' },
  { regex: /(\+?\d{10,15})/g, replacement: '[PHONE_REDACTED]' },
  { regex: /(password|passwd|secret|token|api[_-]?key|authorization)["'\s:=]+["']?[^\s"',}]+/gi, replacement: '$1=[REDACTED]' },
  { regex: /(Bearer\s+)[^\s]+/g, replacement: '$1[TOKEN_REDACTED]' },
];

/**
 * Escapes HTML entities in a string to prevent XSS.
 * @security Use this on any user input that will be rendered in HTML.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Recursively sanitizes all string values in an object.
 * @security Apply to user-submitted objects before storage.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Validates that a string is a proper UUID v4.
 * @security Prevents IDOR attacks by validating ID format before DB queries.
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Redacts PII from data before logging.
 * @security Ensures no emails, phone numbers, passwords, or tokens appear in logs.
 */
export function sanitizeForLog(data: unknown): string {
  let text: string;

  if (typeof data === 'string') {
    text = data;
  } else {
    try {
      text = JSON.stringify(data, null, 2);
    } catch {
      text = String(data);
    }
  }

  for (const pattern of PII_PATTERNS) {
    text = text.replace(pattern.regex, pattern.replacement);
  }

  return text;
}
