import crypto from "node:crypto";

export const FINGERPRINT_VERSION = 1;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\\/][\w.-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 24)
    .sort()
    .join(" ");
}

function normalizeList(values) {
  return [...new Set((values || []).map(normalizeText).filter(Boolean))].sort().join(",");
}

export function buildActivityFingerprint(activity) {
  const input = [
    activity.project || "",
    normalizeText(activity.domain || ""),
    normalizeText(activity.topic || ""),
    normalizeList(activity.technologies),
    normalizeText(activity.task || ""),
  ].join("|");
  return {
    version: FINGERPRINT_VERSION,
    value: `sha256:${crypto.createHash("sha256").update(input).digest("hex")}`,
  };
}
