import crypto from "node:crypto";

export const FINGERPRINT_VERSION = 1;

type FingerprintActivity = {
  project?: unknown;
  domain?: unknown;
  topic?: unknown;
  technologies?: unknown;
  task?: unknown;
};

function normalizeText(value: unknown): string {
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

function normalizeList(values: unknown): string {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))].sort().join(",");
}

export function buildActivityFingerprint(activity: FingerprintActivity) {
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
