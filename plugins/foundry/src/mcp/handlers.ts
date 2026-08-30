import { ensure } from "../core/storage.ts";
import {
  handleActivityCapture,
  handleActivityDigestList,
  handleActivityGet,
  handleActivityList,
  handleActivityQuery,
} from "../core/activities.ts";
import {
  handleCandidateCreate,
  handleCandidateEvaluate,
  handleCandidateGet,
  handleCandidateList,
  handleCandidateMatch,
  handleCandidateQuery,
  handleCandidateResolve,
} from "../core/candidates.ts";
import { handleEventList } from "../core/events.ts";
import { handleContextBudget, handleTelemetryMetrics } from "../core/context-budget.ts";
import { handleGovernanceResolve, handleGovernanceScan, handleSkillGraphValidate } from "../core/governance.ts";
import { handleHubCleanup, handleHubConfig, handleHubDoctor, handleHubInit, handleHubStatus } from "../core/hub.ts";
import { handleHubMigrate, migrationStatus } from "../core/migration.ts";
import { handlePatternGet, handlePatternIndex, handlePatternQuery } from "../core/patterns.ts";
import { handlePluginCacheCleanup } from "../core/cache.ts";
import { handleSkillIndex } from "../core/skill-index.ts";
import {
  handleSkillCreate,
  handleSkillEvaluate,
  handleSkillGenerate,
  handleSkillGet,
  handleSkillList,
  handleSkillPublish,
  handleSkillQuery,
  handleSkillRead,
  handleSkillEvolve,
} from "../core/skills.ts";
import { handleUsageCapture } from "../core/usage.ts";
import { getTool } from "./registry.ts";

type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs) => Promise<unknown>;

/**
 * Map of tool name → async handler function.
 *
 * @type {Object<string, (args: ToolArgs) => Promise<object>>}
 */
const HANDLERS: Record<string, ToolHandler> = {
  hub_init: handleHubInit,
  hub_migrate: handleHubMigrate,
  hub_config: handleHubConfig,
  hub_status: handleHubStatus,
  hub_doctor: handleHubDoctor,
  hub_cleanup: handleHubCleanup,
  plugin_cache_cleanup: handlePluginCacheCleanup,
  context_budget: handleContextBudget,
  governance_scan: handleGovernanceScan,
  governance_resolve: handleGovernanceResolve,
  skill_graph_validate: handleSkillGraphValidate,
  activity_capture: handleActivityCapture,
  activity_digest_list: handleActivityDigestList,
  activity_list: handleActivityList,
  activity_query: handleActivityQuery,
  activity_get: handleActivityGet,
  candidate_create: handleCandidateCreate,
  candidate_match: handleCandidateMatch,
  candidate_query: handleCandidateQuery,
  candidate_get: handleCandidateGet,
  candidate_resolve: handleCandidateResolve,
  pattern_index: handlePatternIndex,
  pattern_query: handlePatternQuery,
  pattern_get: handlePatternGet,
  candidate_list: handleCandidateList,
  candidate_evaluate: handleCandidateEvaluate,
  skill_create: handleSkillCreate,
  skill_generate: handleSkillGenerate,
  skill_evolve: handleSkillEvolve,
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
  skill_read: handleSkillRead,
  skill_list: handleSkillList,
  skill_index: handleSkillIndex,
  skill_query: handleSkillQuery,
  skill_get: handleSkillGet,
  usage_capture: handleUsageCapture,
  event_list: handleEventList,
  telemetry_metrics: handleTelemetryMetrics,
};

const MIGRATION_ALLOWED = new Set([
  "hub_init",
  "hub_migrate",
  "hub_status",
  "hub_doctor",
  "event_list",
  "telemetry_metrics",
  "plugin_cache_cleanup",
]);

const WRITE_TOOLS = new Set([
  "hub_config",
  "hub_cleanup",
  "activity_capture",
  "candidate_create",
  "candidate_resolve",
  "candidate_evaluate",
  "pattern_index",
  "skill_create",
  "skill_generate",
  "skill_evolve",
  "skill_evaluate",
  "skill_publish",
  "context_budget",
  "usage_capture",
  "governance_resolve",
]);

/**
 * Ensure storage exists, then dispatch a tool call to its handler.
 *
 * @param {string} name - Tool name.
 * @param {ToolArgs} [args={}] - Tool arguments. Default is `{}`
 * @returns {Promise<object>} The handler's result.
 * @throws {Error} When `name` does not map to a known tool.
 */
export async function call(name: string, args: ToolArgs = {}): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler || !getTool(name)) throw Error(`Unknown Usora tool: ${name}`);
  await ensure();
  if (WRITE_TOOLS.has(name) && !MIGRATION_ALLOWED.has(name) && (await migrationStatus()).migration_required) {
    throw Error("Hub migration required before writing v2 records. Run hub_migrate with dry_run, then confirm=true.");
  }
  return handler(args);
}
