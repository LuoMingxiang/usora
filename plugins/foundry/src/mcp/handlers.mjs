import { ensure } from "../core/storage.mjs";
import {
  handleActivityCapture,
  handleActivityDigestList,
  handleActivityGet,
  handleActivityList,
  handleActivityQuery,
} from "../core/activities.mjs";
import {
  handleCandidateCreate,
  handleCandidateEvaluate,
  handleCandidateGet,
  handleCandidateList,
  handleCandidateMatch,
  handleCandidateQuery,
  handleCandidateResolve,
} from "../core/candidates.mjs";
import { handleEventList } from "../core/events.mjs";
import { handleContextBudget, handleTelemetryMetrics } from "../core/context-budget.mjs";
import { handleHubCleanup, handleHubConfig, handleHubDoctor, handleHubInit, handleHubStatus } from "../core/hub.mjs";
import { handleHubMigrate, migrationStatus } from "../core/migration.mjs";
import { handlePatternGet, handlePatternIndex, handlePatternQuery } from "../core/patterns.mjs";
import { handlePluginCacheCleanup } from "../core/cache.mjs";
import { handleSkillIndex } from "../core/skill-index.mjs";
import {
  handleSkillCreate,
  handleSkillEvaluate,
  handleSkillGenerate,
  handleSkillGet,
  handleSkillList,
  handleSkillPublish,
  handleSkillQuery,
  handleSkillRead,
} from "../core/skills.mjs";

/**
 * Map of tool name → async handler function.
 *
 * @type {Object<string, (args: ToolArgs) => Promise<object>>}
 */
const HANDLERS = {
  hub_init: handleHubInit,
  hub_migrate: handleHubMigrate,
  hub_config: handleHubConfig,
  hub_status: handleHubStatus,
  hub_doctor: handleHubDoctor,
  hub_cleanup: handleHubCleanup,
  plugin_cache_cleanup: handlePluginCacheCleanup,
  context_budget: handleContextBudget,
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
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
  skill_read: handleSkillRead,
  skill_list: handleSkillList,
  skill_index: handleSkillIndex,
  skill_query: handleSkillQuery,
  skill_get: handleSkillGet,
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
  "skill_evaluate",
  "skill_publish",
  "context_budget",
]);

/**
 * Ensure storage exists, then dispatch a tool call to its handler.
 *
 * @param {string} name - Tool name.
 * @param {ToolArgs} [args={}] - Tool arguments. Default is `{}`
 * @returns {Promise<object>} The handler's result.
 * @throws {Error} When `name` does not map to a known tool.
 */
export async function call(name, args = {}) {
  const handler = HANDLERS[name];
  if (!handler) throw Error(`Unknown Usora tool: ${name}`);
  await ensure();
  if (WRITE_TOOLS.has(name) && !MIGRATION_ALLOWED.has(name) && (await migrationStatus()).migration_required) {
    throw Error("Hub migration required before writing v2 records. Run hub_migrate with dry_run, then confirm=true.");
  }
  return handler(args);
}
