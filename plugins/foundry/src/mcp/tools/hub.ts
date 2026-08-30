import { AUTOMATION_POLICIES } from "../../core/storage.ts";
import type { McpTool } from "../registry.ts";

export const hubTools = [
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
      "Inspect Usora counts, configuration, and resolved data locations without loading all Activities. Use this as the source of truth when users ask where Practice data, Shared Knowledge, Activity, Session, Pattern, Candidate, or Skill data lives. Returns host-local practice paths, shared knowledge paths, path resolution sources, registered Activity Source locations, counts, and next_action.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hub_migrate",
    description:
      "Explicitly migrate a v1 Hub to the current schema. Defaults to dry run; pass confirm=true to back up and migrate.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: { type: "boolean" },
        confirm: { type: "boolean", description: "Required true to write migration changes." },
      },
    },
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
] satisfies McpTool[];
