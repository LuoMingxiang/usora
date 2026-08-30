import { allToolDefinitions } from "./tools/index.ts";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const seen = new Set<string>();
for (const tool of allToolDefinitions) {
  if (seen.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`);
  seen.add(tool.name);
}

export const tools = allToolDefinitions;
export const toolRegistry = new Map(tools.map((tool) => [tool.name, tool]));

export function listTools(): McpTool[] {
  return tools;
}

export function getTool(name: string): McpTool | undefined {
  return toolRegistry.get(name);
}
