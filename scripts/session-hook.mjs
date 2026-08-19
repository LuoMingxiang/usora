#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { stdin as _stdin } from "process";

async function readStdin() {
  const chunks = [];
  for await (const chunk of _stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function safeFilename(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) {
      console.error("No stdin input");
      process.exit(0);
    }
    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse stdin JSON:", e.message);
      process.exit(1);
    }

    const session_id =
      event.session_id || event.sessionId || event.session?.id || event.session?.session_id || null;
    const cwd = event.cwd || event.workingDirectory || event.session?.cwd || process.cwd();
    const timestamp =
      event.timestamp || event.time || event.ended_at || new Date().toISOString();
    const transcript_path =
      event.transcript_path || event.transcriptPath || event.transcript?.path || event.session?.transcript || null;

    const hubDir = path.join(".usora", "activities");
    await ensureDir(hubDir);

    const tsSafe = new Date(timestamp).toISOString().replace(/[:.]/g, "-");
    const idSafe = session_id ? safeFilename(String(session_id)) : `no-session-${Date.now()}`;
    const filename = `${idSafe}-${tsSafe}.activity.json`;
    const filepath = path.join(hubDir, filename);

    // Simple dedupe: if there exists an activity file for same session_id in hubDir with newer or similar ts, skip
    if (session_id) {
      try {
        const files = await fs.readdir(hubDir);
        for (const f of files) {
          if (f.includes(idSafe) && f.endsWith(".activity.json")) {
            const stats = await fs.stat(path.join(hubDir, f));
            // if existing file was modified within last 5 minutes, skip
            if (Date.now() - stats.mtimeMs < 5 * 60 * 1000) {
              console.log("Skipping write: recent activity already exists for session_id", session_id);
              process.exit(0);
            }
          }
        }
      } catch (e) {
        // ignore and continue
      }
    }

    const activity = {
      recorded_at: new Date().toISOString(),
      source: {
        host_env: {
          CLAUDE_PLUGIN_ROOT: process.env.CLAUDE_PLUGIN_ROOT || null,
          CODEBUDDY_PLUGIN_ROOT: process.env.CODEBUDDY_PLUGIN_ROOT || null,
        },
      },
      extracted: {
        session_id: session_id || null,
        cwd,
        timestamp,
        transcript_path: transcript_path || null,
      },
      event_raw: event,
    };

    await fs.writeFile(filepath, JSON.stringify(activity, null, 2), "utf8");
    console.log("Wrote activity:", filepath);
    process.exit(0);
  } catch (err) {
    console.error("session-hook error:", err);
    process.exit(1);
  }
}

main();
