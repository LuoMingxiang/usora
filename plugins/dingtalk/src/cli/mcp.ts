#!/usr/bin/env node
import fs from "node:fs/promises";
import readline from "node:readline";
import { createDingTalkService, type DingTalkServiceConfig } from "../service.ts";
import { startDingTalkStream } from "../stream.ts";

const definitions = [
  {
    name: "dingtalk_status",
    description: "Inspect DingTalk configuration and connection status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dingtalk_sync",
    description: "Deliver pending Foundry event subscriptions to DingTalk.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dingtalk_capture_document",
    description: "Fetch a specified DingTalk document and capture it as a Foundry Activity.",
    inputSchema: {
      type: "object",
      required: ["docKey", "operatorId"],
      properties: {
        docKey: { type: "string" },
        operatorId: { type: "string", description: "DingTalk unionId with access to this document" },
      },
    },
  },
  {
    name: "dingtalk_replay",
    description: "Return a specified dead-letter delivery to the pending queue.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
];
let service: Awaited<ReturnType<typeof createDingTalkService>> | undefined;
let stream: Awaited<ReturnType<typeof startDingTalkStream>> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let starting: Promise<void> | undefined;
let enabled = false;
let failure: string | undefined;
let syncing = false;

async function start() {
  if (starting) return starting;
  starting = (async () => {
    const file = process.env.DINGTALK_CONFIG;
    const config = file ? (JSON.parse(await fs.readFile(file, "utf8")) as DingTalkServiceConfig) : {};
    enabled = config.enabled === true;
    if (!enabled) return;
    const ready = await createDingTalkService(config);
    if (config.stream) stream = await startDingTalkStream(ready);
    service = ready;
    // ponytail: fixed 30-second poll; expose a cadence only if measured delivery latency needs it.
    timer = setInterval(() => {
      void sync().catch(() => {
        failure = "Delivery failed; inspect persisted delivery diagnostics";
      });
    }, 30_000);
    timer.unref();
  })().catch(() => {
    failure = "Startup failed; check DingTalk config, credentials and Foundry MCP path";
  });
  return starting;
}
async function sync() {
  if (!service) throw Error(failure || "DingTalk integration is disabled");
  if (syncing) throw Error("Sync already running");
  syncing = true;
  try {
    return await service.sync();
  } finally {
    syncing = false;
  }
}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
rl.on("line", (line) => {
  queue = queue.then(async () => {
    let id: unknown = null;
    try {
      const request = JSON.parse(line);
      id = request.id;
      if (id === undefined) {
        if (request.method === "notifications/initialized") void start();
        return;
      }
      let result;
      if (request.method === "initialize")
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "usora-dingtalk", version: "0.1.0" },
        };
      else if (request.method === "ping") result = {};
      else if (request.method === "tools/list") result = { tools: definitions };
      else if (request.method === "tools/call") {
        await start();
        const name = request.params?.name;
        const args = request.params?.arguments || {};
        let data;
        if (name === "dingtalk_status")
          data = {
            enabled,
            ready: Boolean(service),
            stream: Boolean(stream?.connected),
            ...(failure ? { error: failure } : {}),
          };
        else if (name === "dingtalk_sync") data = await sync();
        else if (
          name === "dingtalk_capture_document" &&
          service &&
          typeof args.docKey === "string" &&
          typeof args.operatorId === "string"
        )
          data = await service.captureDocument(args.docKey, args.operatorId);
        else if (name === "dingtalk_replay" && service && typeof args.id === "string")
          data = await service.replay(args.id);
        else throw Error("Unknown tool, invalid arguments, or integration unavailable");
        result = { content: [{ type: "text", text: JSON.stringify(data) }] };
      } else {
        process.stdout.write(
          JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }) + "\n",
        );
        return;
      }
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: "DingTalk request failed; check arguments and local configuration" },
        }) + "\n",
      );
    }
  });
});
async function close() {
  await queue;
  await starting;
  if (timer) clearInterval(timer);
  stream?.disconnect();
}
rl.on("close", () => {
  void close();
});
process.on("SIGTERM", () => {
  void close().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
  void close().finally(() => process.exit(0));
});
