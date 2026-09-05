import { spawn } from "node:child_process";
import path from "node:path";
import { createCommandRegistry, type IntegrationCommandHandler } from "@usora/integration";

export type FoundryCall = (name: string, args?: Record<string, unknown>) => Promise<Record<string, any>>;

// The installed Foundry MCP executable is the public boundary; never import its private modules.
export function createFoundryClient(script: string, env = process.env): FoundryCall {
  if (!path.isAbsolute(script)) throw Error("USORA_FOUNDRY_MCP must be an absolute path to Foundry dist/mcp.js");
  return (name, args = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], { env, stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(Error("Foundry MCP timeout"));
      }, 30_000);
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.length > 8_000_000) {
          child.kill();
          reject(Error("Foundry response exceeds limit"));
        }
      });
      child.stderr.resume();
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", () => {
        clearTimeout(timer);
        try {
          const response = output
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
            .find((item) => item.id === 2);
          if (response?.error || response?.result?.isError)
            throw Error(response.error?.message || "Foundry tool failed");
          const text = response?.result?.content?.find((item: { type: string }) => item.type === "text")?.text;
          if (!text) throw Error("Foundry returned no tool result");
          const result = JSON.parse(text);
          if (result.error) throw Error(String(result.error));
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "usora-dingtalk", version: "0.1.0" },
            },
          },
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } },
        ]
          .map((item) => JSON.stringify(item))
          .join("\n") + "\n",
      );
    });
}

export function createFoundryCommands(call: FoundryCall) {
  const entries: Array<[string, IntegrationCommandHandler]> = [];
  const mappings = {
    "hub.status": "hub_status",
    "candidate.list": "candidate_query",
    "candidate.get": "candidate_get",
    "skill.get": "skill_get",
    "governance.scan": "governance_scan",
    "governance.resolve": "governance_resolve",
    "candidate.approve": "candidate_evaluate",
    "candidate.reject": "candidate_evaluate",
    "foundry.run": "pattern_index",
    "digest.get": "telemetry_metrics",
  };
  for (const [name, tool] of Object.entries(mappings))
    entries.push([
      name,
      async (command) => {
        try {
          const args = command.args as Record<string, unknown>;
          const extra =
            name.startsWith("candidate.") && ["candidate.approve", "candidate.reject"].includes(name)
              ? {
                  result: name === "candidate.approve" ? "pass" : "fail",
                  reviewer: command.actor.id,
                  request_id: command.id,
                }
              : name === "governance.resolve"
                ? { actor: command.actor.id, request_id: command.id }
                : {};
          return { ok: true, data: await call(tool, { ...args, ...extra }) };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Foundry command failed" };
        }
      },
    ]);
  return createCommandRegistry(entries);
}
