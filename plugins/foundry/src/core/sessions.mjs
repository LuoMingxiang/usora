import crypto from "node:crypto";
import path from "node:path";
import { SESSION_RECORD_SCHEMA_VERSION, dirPath, ensure, now, writeJson } from "./storage.mjs";

function sessionFile(sessionId) {
  const hash = crypto
    .createHash("sha256")
    .update(sessionId || "unknown")
    .digest("hex")
    .slice(0, 24);
  return `session-${hash}.json`;
}

export async function writeSessionRecord(sessionId, record) {
  await ensure();
  const timestamp = now();
  const item = {
    schema_version: SESSION_RECORD_SCHEMA_VERSION,
    id: sessionId || `session-${timestamp}`,
    session_id: sessionId || null,
    updated_at: timestamp,
    ...record,
  };
  await writeJson(path.join(await dirPath("sessions"), sessionFile(item.id)), item);
  return item;
}
