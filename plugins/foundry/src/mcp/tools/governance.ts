import type { McpTool } from "../registry.ts";

export const governanceTools = [
  {
    name: "governance_scan",
    description: "Scan Skill metadata for unused, low-success, duplicate, superseded, and stale Skills.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        min_success_rate: { type: "number" },
        duplicate_threshold: { type: "number" },
        stale_days: { type: "number" },
      },
    },
  },
  {
    name: "governance_resolve",
    description:
      "Apply an auditable governance resolution. MERGE, DEPRECATE, and RETIRE require the configured Maintainer.",
    inputSchema: {
      type: "object",
      required: ["skill", "action"],
      properties: {
        skill: { type: "string" },
        action: { type: "string", enum: ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"] },
        target_skill: { type: "string" },
        reason: { type: "string" },
        actor: { type: "string" },
        request_id: { type: "string", description: "Stable integration request id for retry deduplication." },
        related_to: { type: "string" },
        depends_on: { type: "string" },
        conflicts_with: { type: "string" },
      },
    },
  },
  {
    name: "skill_graph_validate",
    description: "Validate Skill graph references: related_to, depends_on, supersedes, and conflicts_with.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "event_list",
    description: "List recent lifecycle events.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
  {
    name: "telemetry_metrics",
    description:
      "Summarize IntelligenceRun and CandidateResolved telemetry with trend metrics; token counts are chars/4 estimates only.",
    inputSchema: { type: "object", properties: {} },
  },
] satisfies McpTool[];
