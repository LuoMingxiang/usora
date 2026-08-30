import readline from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { call } from "./handlers.ts";
import { listTools } from "./registry.ts";

type JsonRpcId = string | number | null;
type RpcParams = Record<string, unknown>;
type RpcRequest = {
  id?: JsonRpcId;
  method?: string;
  params?: RpcParams;
};
type RpcResponse = {
  jsonrpc: "2.0";
  id?: JsonRpcId | undefined;
  result?: unknown;
  error?: { code: number; message: string };
};

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
function readServerVersion(): string {
  try {
    const plugin = JSON.parse(readFileSync(path.join(pluginRoot, "plugin.json"), "utf8")) as { version?: unknown };
    return typeof plugin.version === "string" ? plugin.version : "2.0.0";
  } catch {
    return "2.0.0";
  }
}
const serverVersion = readServerVersion();

function jsonRpcResult(id: JsonRpcId | undefined, value: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result: value };
}

/**
 * Build a successful `tools/call` response (MCP `content` envelope).
 *
 * @param {number | string | undefined} id - Request id.
 * @param {any} value - Tool result, serialized as pretty-printed JSON text.
 * @returns {{ jsonrpc: string; id: any; result: any }}
 */
function toolCallResult(id: JsonRpcId | undefined, value: unknown): RpcResponse {
  return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
}

/**
 * Build a JSON-RPC error response (code `-32000`).
 *
 * @param {number | string | undefined} id - Request id.
 * @param {string} message - Error message.
 * @returns {{ jsonrpc: string; id: any; error: { code: number; message: string } }}
 */
function jsonRpcError(id: JsonRpcId | undefined, message: string): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}

/**
 * Write a single JSON-RPC response line to stdout.
 *
 * @param {object} line - Serializable response object.
 * @returns {void}
 */
function write(line: RpcResponse): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

/**
 * Handle a non-`tools/call` request (initialize, tools/list, etc.).
 *
 * @param {RpcRequest} req - Parsed request.
 * @returns {object | null} The response object, or `null` for notifications (requests without an `id`).
 */
function handleRequest(req: RpcRequest): RpcResponse | null {
  switch (req.method) {
    case "initialize":
      return jsonRpcResult(req.id, {
        protocolVersion: typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "usora", version: serverVersion },
      });
    case "tools/list":
      return jsonRpcResult(req.id, { tools: listTools() });
    default:
      if (req.id !== undefined) {
        return jsonRpcError(req.id, `Unsupported method: ${req.method}`);
      }
      return null;
  }
}

function parseRequest(line: string): RpcRequest {
  const value = JSON.parse(line) as unknown;
  if (!value || typeof value !== "object") throw new Error("Invalid JSON-RPC request");
  return value as RpcRequest;
}

function toolCallParams(params: RpcParams | undefined): { name: string; args: RpcParams } {
  if (!params || typeof params.name !== "string") throw new Error("Invalid tools/call params: name is required");
  const rawArgs = params.arguments;
  if (rawArgs === undefined) return { name: params.name, args: {} };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    throw new Error("Invalid tools/call params: arguments must be an object");
  }
  return { name: params.name, args: rawArgs as RpcParams };
}

/** Stdio line reader for incoming JSON-RPC messages. */
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

/**
 * Serializes request handling so concurrent lines are processed in order.
 *
 * @type {Promise<void>}
 */
let queue = Promise.resolve();

rl.on("line", (line) => {
  queue = queue.then(async () => {
    let req: RpcRequest | undefined;
    try {
      req = parseRequest(line);
      let response: RpcResponse | null;
      if (req.method === "tools/call") {
        const { name, args } = toolCallParams(req.params);
        const value = await call(name, args);
        response = toolCallResult(req.id, value);
      } else {
        response = handleRequest(req);
      }
      if (response) write(response);
    } catch (err) {
      if (req?.id !== undefined) write(jsonRpcError(req.id, err instanceof Error ? err.message : String(err)));
    }
  });
});
