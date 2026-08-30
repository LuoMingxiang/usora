import type { McpTool } from "../registry.ts";

export const candidateTools = [
  {
    name: "context_budget",
    description:
      "Estimate context size for a Foundry intelligence stage using chars/4 token estimates and emit overflow events when limits are exceeded.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["pattern_judge", "candidate_resolver", "skill_compiler", "evaluator"] },
        required: { type: "object" },
        recommended: { type: "object" },
        optional: { type: "object" },
      },
    },
  },
  {
    name: "candidate_create",
    description: "Create a Candidate from an observed reusable pattern; do not create one for a one-off task.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" },
                },
              },
            ],
          },
        },
        source: { type: "string" },
      },
    },
  },
  {
    name: "candidate_match",
    description: "Return local Candidate and Skill metadata matches without reading Skill content.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "candidate_resolve",
    description:
      "Resolve a Candidate proposal locally: match an existing Candidate/Skill, create a new Candidate, or drop low-evidence input.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        high_value: { type: "boolean" },
        threshold: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" },
                },
              },
            ],
          },
        },
        source: { type: "string" },
      },
    },
  },
  {
    name: "pattern_index",
    description: "Update the local Pattern index from Activity digests. Defaults to incremental NEW Activity indexing.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["incremental", "rebuild"] } },
    },
  },
  {
    name: "pattern_query",
    description: "Query local Pattern metadata without loading full Activities.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        eligible: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "pattern_get",
    description: "Read one Pattern metadata record by fingerprint.",
    inputSchema: {
      type: "object",
      required: ["fingerprint"],
      properties: {
        fingerprint: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "candidate_list",
    description: "Deprecated: use candidate_query. List recent Candidates.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
  {
    name: "candidate_query",
    description: "Query Candidate records with limit/state/since and optional field projection.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "candidate_get",
    description: "Read one Candidate record by id.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "candidate_evaluate",
    description: "Evaluate a Candidate as pass or fail and record the reviewer.",
    inputSchema: {
      type: "object",
      required: ["id", "result"],
      properties: {
        id: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" },
      },
    },
  },
] satisfies McpTool[];
