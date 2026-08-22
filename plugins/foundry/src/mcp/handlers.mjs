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
  return handler(args);
}
