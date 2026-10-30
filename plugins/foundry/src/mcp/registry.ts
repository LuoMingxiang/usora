import { allToolDefinitions } from "./tools/index.ts";
import { USORA_TOOL_NAMES, type UsoraToolName } from "../core/tool-catalog.ts";

export type McpTool = {
  name: UsoraToolName;
  description: string;
  inputSchema: Record<string, unknown>;
};

const seen = new Set<string>();
for (const tool of allToolDefinitions) {
  if (seen.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`);
  seen.add(tool.name);
}
for (const name of USORA_TOOL_NAMES) {
  if (!seen.has(name)) throw new Error(`Missing MCP tool definition: ${name}`);
}

export const tools = allToolDefinitions;
export const toolRegistry = new Map<string, McpTool>(tools.map((tool) => [tool.name, tool]));

export function listTools(): McpTool[] {
  return tools;
}

export function getTool(name: string): McpTool | undefined {
  return toolRegistry.get(name);
}
