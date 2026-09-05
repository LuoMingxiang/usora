#!/usr/bin/env node

// plugins/dingtalk/src/cli/mcp.ts
import { stdin, stdout } from "node:process";
async function main() {
  const chunks = [];
  for await (const chunk of stdin)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw)
    return;
  const request = JSON.parse(raw);
  if (request.method === "tools/list") {
    stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { tools: [] } }));
    stdout.write(`
`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
