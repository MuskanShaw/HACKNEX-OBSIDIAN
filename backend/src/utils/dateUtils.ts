/**
 * Date and Timestamp Normalization Utilities for OBSIDIAN Storefront Platform
 *
 * Ensures all incoming timestamps from frontend UI, localStorage, or API callers
 * are strictly normalized to valid ISO-8601 strings suitable for PostgreSQL TIMESTAMPTZ columns.
 * Prevents PostgreSQL errors such as:
 *   "invalid input syntax for type timestamp with time zone: 'Just now'"
 */

// UI / human-readable relative string patterns
const RELATIVE_TIME_REGEX =
  /^\s*(?:(\d+|a|an|one|two)\s+)?(sec(?:ond)?|min(?:ute)?|hr|hour|day|week|month|year)s?\s+ago\s*$/i;

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
};

const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  sec: 1000,
  second: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Checks whether a given string is a human-readable display string
 * such as "Just now", "Today", "Yesterday", "5 minutes ago", etc.
 */
export function isRelativeDisplayString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return false;

  if (
    trimmed === 'just now' ||
    trimmed === 'just-now' ||
    trimmed === 'justnow' ||
    trimmed === 'right now' ||
    trimmed === 'now' ||
    trimmed === 'today' ||
    trimmed === 'yesterday'
  ) {
    return true;
  }

  return RELATIVE_TIME_REGEX.test(trimmed);
}

/**
 * Parses a relative display string into an actual Date object.
 * Returns null if the string is not a recognized relative time string.
 */
export function parseRelativeTimeString(val: string, baseDate: Date = new Date()): Date | null {
  const trimmed = val.trim().toLowerCase();

  if (
    trimmed === 'just now' ||
    trimmed === 'just-now' ||
    trimmed === 'justnow' ||
    trimmed === 'right now' ||
    trimmed === 'now' ||
    trimmed === 'today'
  ) {
    return new Date(baseDate.getTime());
  }

  if (trimmed === 'yesterday') {
    return new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  }

  const match = trimmed.match(RELATIVE_TIME_REGEX);
  if (match) {
    const rawQty = match[1] ? match[1].toLowerCase() : '1';
    const unit = match[2].toLowerCase();

    let qty = 1;
    if (WORD_NUMBERS[rawQty] !== undefined) {
      qty = WORD_NUMBERS[rawQty];
    } else {
      const parsedNum = parseInt(rawQty, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        qty = parsedNum;
      }
    }

    const unitKey = Object.keys(UNIT_TO_MS).find(
      (k) => unit === k || unit.startsWith(k)
    );
    const msMultiplier = unitKey ? UNIT_TO_MS[unitKey] : 60 * 1000;
    return new Date(baseDate.getTime() - qty * msMultiplier);
  }

  return null;
}

/**
 * Validates and converts an unknown value into a strictly valid ISO-8601 string.
 * Rejects invalid strings and human-readable text from entering PostgreSQL directly.
 */
export function normalizeTimestamp(value: unknown, fallbackDate: Date = new Date()): string {
  if (value === null || value === undefined) {
    return fallbackDate.toISOString();
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? fallbackDate.toISOString() : value.toISOString();
  }

  if (typeof value === 'number' && !isNaN(value) && value > 0) {
    // If epoch in seconds (e.g. 10 digits), convert to ms
    const ms = value < 10000000000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? fallbackDate.toISOString() : d.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallbackDate.toISOString();
    }

    // 1. Check if relative display string like "Just now", "5 minutes ago"
    if (isRelativeDisplayString(trimmed)) {
      const parsedRelative = parseRelativeTimeString(trimmed, fallbackDate);
      if (parsedRelative && !isNaN(parsedRelative.getTime())) {
        return parsedRelative.toISOString();
      }
      return fallbackDate.toISOString();
    }

    // 2. Check if numeric timestamp string (e.g. "1790195726168")
    if (/^\d{10,13}$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 10000000000 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }

    // 3. Attempt standard Date parsing (ISO 8601, RFC 2822)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      // Ensure sanity: valid year range between 1970 and 2100
      if (year >= 1970 && year <= 2100) {
        return parsed.toISOString();
      }
    }
  }

  // 4. Fallback for completely invalid strings like "abc123"
  return fallbackDate.toISOString();
}

/**
 * Candidate order date/time field names in priority order.
 * Absolute/real timestamps take precedence over relative display fields.
 */
const CANDIDATE_TIMESTAMP_FIELDS = [
  'createdAt',
  'created_at',
  'orderDate',
  'order_date',
  'timestamp',
  'updatedAt',
  'updated_at',
  'date',
  'time',
  'orderTime',
  'order_time',
] as const;

/**
 * DATA-PRESERVATION RULE (Requirement 5):
 * If the incoming order contains a real timestamp field (e.g., createdAt, orderDate, timestamp),
 * use that real timestamp instead of replacing it with the current time.
 * If only relative/display fields (e.g. "Just now") exist, normalize them to a computed Date.
 * If no valid dates exist, fall back safely to fallbackDate.toISOString().
 */
export function extractAndNormalizeOrderTimestamp(
  order: Record<string, any>,
  fallbackDate: Date = new Date()
): string {
  if (!order || typeof order !== 'object') {
    return fallbackDate.toISOString();
  }

  // Pass 1: Look for genuine, absolute timestamp fields (non-relative)
  for (const field of CANDIDATE_TIMESTAMP_FIELDS) {
    const rawVal = order[field];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      // If it's a relative string like "Just now", do NOT treat it as a real timestamp in Pass 1
      if (isRelativeDisplayString(rawVal)) {
        continue;
      }

      if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        return rawVal.toISOString();
      }

      if (typeof rawVal === 'number' && !isNaN(rawVal) && rawVal > 0) {
        const ms = rawVal < 10000000000 ? rawVal * 1000 : rawVal;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toISOString();
      }

      if (typeof rawVal === 'string') {
        const trimmed = rawVal.trim();
        // Check numeric string
        if (/^\d{10,13}$/.test(trimmed)) {
          const num = Number(trimmed);
          const ms = num < 10000000000 ? num * 1000 : num;
          const d = new Date(ms);
          if (!isNaN(d.getTime())) return d.toISOString();
        }

        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          const year = parsed.getUTCFullYear();
          if (year >= 1970 && year <= 2100) {
            return parsed.toISOString();
          }
        }
      }
    }
  }

  // Pass 2: Look for relative display strings (e.g. "Just now", "5 minutes ago", "Yesterday")
  for (const field of CANDIDATE_TIMESTAMP_FIELDS) {
    const rawVal = order[field];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      if (isRelativeDisplayString(rawVal)) {
        const parsedRelative = parseRelativeTimeString(String(rawVal), fallbackDate);
        if (parsedRelative && !isNaN(parsedRelative.getTime())) {
          return parsedRelative.toISOString();
        }
      }
    }
  }

  // Pass 3: Unrecoverable or missing, safely return fallback
  return fallbackDate.toISOString();
}
