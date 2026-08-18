import path from "node:path";

/**
 * Assert that a value is a non-empty string and return it.
 *
 * @param {any} value - Value to validate.
 * @param {string} field - Field name used in the error message.
 * @returns {string}
 * @throws {Error} When `value` is not a string.
 */
export function requireString(value, field) {
  if (typeof value !== "string") {
    throw Error(`${field} is required`);
  }
  return value;
}

/**
 * Validate a name against a safe, filesystem-friendly format (`letters, numbers, hyphens` only, up to 64 chars).
 *
 * @param {any} value - Candidate name.
 * @param {string} field - Field name used in the error message.
 * @returns {string} The validated name.
 * @throws {Error} When the name is not a string or fails the format check.
 */
export function safeName(value, field) {
  requireString(value, field);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)) {
    throw Error(`${field} must contain only letters, numbers, and hyphens`);
  }
  return value;
}

export function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Merge two arrays into one de-duplicated array, preserving order.
 *
 * @param {any[] | undefined} left - Base array.
 * @param {any[] | undefined} right - Additional values to append.
 * @returns {any[]} Unique values from `left` followed by new values from `right`.
 */
export function mergeUnique(left, right) {
  return [...new Set([...(left || []), ...(right || [])])];
}

/**
 * Clamp a user-supplied list limit to a small, predictable range.
 *
 * @param {any} value - User-supplied limit.
 * @returns {number} Integer between 1 and 100, defaulting to 20.
 */
export function listLimit(value) {
  return Math.min(Math.max(Number(value) || 20, 1), 100);
}
