import type { McpTool } from "../registry.ts";

export const skillTools = [
  {
    name: "skill_create",
    description: "Create a Skill draft with SKILL.md content.",
    inputSchema: {
      type: "object",
      required: ["name", "content"],
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        description: { type: "string" },
        candidate_id: { type: "string" },
      },
    },
  },
  {
    name: "skill_generate",
    description: "Generate a deterministic Skill draft from a passing Candidate without loading full Activities.",
    inputSchema: {
      type: "object",
      required: ["candidate_id"],
      properties: {
        candidate_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "skill_evolve",
    description:
      "Apply or recommend a SkillDelta. With a passing candidate_id, defaults to PATCH an existing similar Skill before creating a new draft.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        candidate_id: { type: "string" },
        pattern_fingerprint: { type: "string" },
        action: { type: "string", enum: ["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"] },
        reason: { type: "string" },
        evidence: { type: "array", items: { type: "object" } },
        target_skill: { type: "string" },
        threshold: { type: "number" },
        changes: {
          type: "object",
          properties: {
            content: { type: "string" },
            content_append: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "skill_evaluate",
    description: "Evaluate a Skill draft as pass or fail.",
    inputSchema: {
      type: "object",
      required: ["name", "result"],
      properties: {
        name: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "skill_publish",
    description:
      "Publish an evaluated Skill as the configured Maintainer by updating the single current Skill in place.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, actor: { type: "string" } },
    },
  },
  {
    name: "skill_read",
    description: "Read one Skill's metadata and SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
  {
    name: "skill_list",
    description: "Deprecated: use skill_query. List recent Skill metadata without loading SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
  {
    name: "skill_index",
    description: "Query or rebuild the local Skill metadata-only index.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["query", "rebuild"] },
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "skill_query",
    description: "Query Skill metadata from the local index without reading SKILL.md.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "skill_get",
    description: "Read one Skill metadata record plus SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
  {
    name: "skill_validate",
    description:
      "Validate one published Hub Skill as an Agent Skills package without changing the source. Returns structured errors, warnings, files, dependencies and compatibility; does not prove independent execution.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skill_id"],
      properties: {
        skill_id: { type: "string", description: "Existing Skill directory name, as returned by skill_query." },
      },
    },
  },
  {
    name: "skill_export",
    description:
      "Export a validated published Skill snapshot as a directory or deterministic ZIP. Never publishes or changes the source. Default conflict policy is error; output_path is an existing absolute parent directory.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skill_id", "output_path"],
      properties: {
        skill_id: { type: "string", description: "Existing published Skill directory name." },
        format: { type: "string", enum: ["directory", "zip"], default: "directory" },
        output_path: {
          type: "string",
          description: "Existing absolute export parent directory outside Hub/plugin data.",
        },
        conflict: { type: "string", enum: ["error", "overwrite"], default: "error" },
        dry_run: {
          type: "boolean",
          default: false,
          description: "Preview validation, files and target without writing.",
        },
      },
    },
  },
  {
    name: "usage_capture",
    description: "Record one runtime Skill usage outcome and update Skill usage metrics. Outcome may be unknown.",
    inputSchema: {
      type: "object",
      required: ["skill"],
      properties: {
        session_id: { type: "string" },
        skill: { type: "string" },
        activity_id: { type: "string" },
        outcome: { type: "string", enum: ["success", "partial", "failure", "unknown"] },
        validation_evidence: { type: "array", items: { type: "string" } },
        project: { type: "string" },
        used_at: { type: "string" },
      },
    },
  },
] satisfies McpTool[];
