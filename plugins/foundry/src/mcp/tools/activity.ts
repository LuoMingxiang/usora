import type { McpTool } from "../registry.ts";

export const activityTools = [
  {
    name: "activity_capture",
    description:
      "Create or update one Activity for the current MCP process. If session_id is supplied, repeated calls with the same value merge; otherwise the server uses its process-scoped session ID.",
    inputSchema: {
      type: "object",
      required: ["task", "result"],
      properties: {
        session_id: { type: "string" },
        task: { type: "string" },
        summary: { type: "string" },
        result: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        approach: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        outcome: { type: "string" },
        source: { type: "string" },
        project: { type: "string" },
        metadata: { type: "object" },
      },
    },
  },
  {
    name: "activity_list",
    description: "Deprecated: use activity_query. List recent Activities from the active Hub without loading archives.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
  {
    name: "activity_digest_list",
    description: "List compact Activity digests for AI retrieval without full Activity records.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
  {
    name: "activity_query",
    description: "Query Activities; defaults to compact digests and only returns full records when projection=full.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        projection: { type: "string", enum: ["digest", "full"] },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "activity_get",
    description: "Read one full Activity record by id; use only when a digest is insufficient.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
] satisfies McpTool[];
