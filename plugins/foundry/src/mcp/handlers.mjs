import { ensure } from "../core/storage.mjs";
import { handleActivityCapture, handleActivityList } from "../core/activities.mjs";
import { handleCandidateCreate, handleCandidateEvaluate, handleCandidateList } from "../core/candidates.mjs";
import { handleEventList } from "../core/events.mjs";
import { handleHubCleanup, handleHubConfig, handleHubDoctor, handleHubInit, handleHubStatus } from "../core/hub.mjs";
import { handlePluginCacheCleanup } from "../core/cache.mjs";
import {
  handleSkillCreate,
  handleSkillEvaluate,
  handleSkillList,
  handleSkillPublish,
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
  activity_capture: handleActivityCapture,
  activity_list: handleActivityList,
  candidate_create: handleCandidateCreate,
  candidate_list: handleCandidateList,
  candidate_evaluate: handleCandidateEvaluate,
  skill_create: handleSkillCreate,
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
  skill_read: handleSkillRead,
  skill_list: handleSkillList,
  event_list: handleEventList,
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
