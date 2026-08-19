import readline from "node:readline";
import { call } from "./handlers.mjs";
import { tools } from "./tools.mjs";

function jsonRpcResult(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}

/**
 * Build a successful `tools/call` response (MCP `content` envelope).
 *
 * @param {number | string | undefined} id - Request id.
 * @param {any} value - Tool result, serialized as pretty-printed JSON text.
 * @returns {{ jsonrpc: string; id: any; result: any }}
 */
function toolCallResult(id, value) {
  return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
}

/**
 * Build a JSON-RPC error response (code `-32000`).
 *
 * @param {number | string | undefined} id - Request id.
 * @param {string} message - Error message.
 * @returns {{ jsonrpc: string; id: any; error: { code: number; message: string } }}
 */
function jsonRpcError(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}

/**
 * Write a single JSON-RPC response line to stdout.
 *
 * @param {object} line - Serializable response object.
 * @returns {void}
 */
function write(line) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

/**
 * Handle a non-`tools/call` request (initialize, tools/list, etc.).
 *
 * @param {RpcRequest} req - Parsed request.
 * @returns {object | null} The response object, or `null` for notifications (requests without an `id`).
 */
function handleRequest(req) {
  switch (req.method) {
    case "initialize":
      return jsonRpcResult(req.id, {
        protocolVersion: req.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "usora", version: "1.0.0" },
      });
    case "tools/list":
      return jsonRpcResult(req.id, { tools });
    default:
      if (req.id !== undefined) {
        return jsonRpcError(req.id, `Unsupported method: ${req.method}`);
      }
      return null;
  }
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
    let req;
    try {
      req = JSON.parse(line);
      let response;
      if (req.method === "tools/call") {
        const value = await call(req.params.name, req.params.arguments);
        response = toolCallResult(req.id, value);
      } else {
        response = handleRequest(req);
      }
      if (response) write(response);
    } catch (err) {
      if (req?.id !== undefined) write(jsonRpcError(req.id, err.message));
    }
  });
});
