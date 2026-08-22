import { AUTOMATION_POLICIES } from "../core/storage.mjs";

export const tools = [
  {
    name: "hub_init",
    description:
      "Initialize the user's local Usora storage in the host plugin data directory, local fallback directory (<cwd>/.usora), or the directory previously chosen via hub_config. Never create sample data. Optionally set maintainer/automation_policy.",
    inputSchema: {
      type: "object",
      properties: {
        maintainer: { type: "string", description: "Optional Primary Maintainer to set during init (e.g. codex)." },
        automation_policy: {
          type: "string",
          enum: AUTOMATION_POLICIES,
          description: "Optional automation policy to set during init.",
        },
      },
    },
  },
  {
    name: "hub_status",
    description:
      "Inspect Hub counts and configuration without loading all Activities. Returns the resolved Hub directory, explicit data_path, config path, counts, and next_action lifecycle hint so the user knows where data lives and what to do next.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hub_doctor",
    description:
      "Run a lightweight local Hub health check for required directories, counts, config, and missing Skill metadata.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hub_cleanup",
    description:
      "Clean in two modes: generated archives processed Activities; all permanently deletes every Usora Hub record, Skill, archive, event, and config and requires confirm=true. It empties the data directory but keeps the Hub directory and config file so the user can review the path.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["generated", "all"] }, confirm: { type: "boolean" } },
    },
  },
  {
    name: "plugin_cache_cleanup",
    description:
      "Preview or delete old installed Usora plugin cache versions, keeping the currently running plugin version. Defaults to dry run; pass confirm=true to delete.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Required true to delete old installed Usora plugin cache versions. Omit or false for dry run.",
        },
      },
    },
  },
  {
    name: "hub_config",
    description:
      "Configure the Maintainer, automation policy, and/or relocate the data directory. Pass `path` to MOVE the existing Hub data to a new directory (migrates existing records and clears the old directory), applied immediately.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Optional new data directory (absolute or relative). Existing data is moved there and the old directory cleared.",
        },
        maintainer: { type: "string" },
        automation_policy: { type: "string", enum: AUTOMATION_POLICIES },
      },
    },
  },
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
    description: "List recent Activities from the active Hub without loading archives.",
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
    description: "List recent Candidates.",
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
    description: "List recent Skill metadata without loading SKILL.md content.",
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
    name: "event_list",
    description: "List recent lifecycle events.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } },
    },
  },
];
