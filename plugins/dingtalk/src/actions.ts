import type { IntegrationCommand, IntegrationCommandName, UsoraActor } from "@usora/integration";
import type { DingTalkCallback } from "./callback.ts";

const GOVERNANCE_ACTIONS: Record<string, string> = {
  "governance.keep": "KEEP",
  "governance.evolve": "EVOLVE",
  "governance.deprecate": "DEPRECATE",
  "governance.retire": "RETIRE",
};

export const DINGTALK_ACTIONS = [
  "candidate.view",
  "candidate.approve",
  "candidate.reject",
  "governance.keep",
  "governance.evolve",
  "governance.deprecate",
  "governance.retire",
  "foundry.run",
] as const;

function value(payload: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (payload[name] !== undefined) return payload[name];
  return undefined;
}

function commandName(actionId: string): IntegrationCommandName {
  if (actionId === "candidate.view") return "candidate.get";
  if (actionId in GOVERNANCE_ACTIONS) return "governance.resolve";
  if (DINGTALK_ACTIONS.includes(actionId as (typeof DINGTALK_ACTIONS)[number])) return actionId;
  throw Error(`Unknown DingTalk action: ${actionId}`);
}

function commandArgs(callback: DingTalkCallback): Record<string, unknown> {
  if (callback.actionId === "candidate.view") return { id: value(callback.payload, "candidateId", "id") };
  if (callback.actionId === "candidate.approve" || callback.actionId === "candidate.reject") {
    return { id: value(callback.payload, "candidateId", "id") };
  }
  if (callback.actionId in GOVERNANCE_ACTIONS) {
    return {
      skill: value(callback.payload, "skill", "skillName"),
      action: GOVERNANCE_ACTIONS[callback.actionId],
    };
  }
  return callback.payload;
}

export function createDingTalkActionCommand(
  callback: DingTalkCallback,
  actor: UsoraActor,
  issuedAt = new Date().toISOString(),
): IntegrationCommand {
  return {
    id: callback.id,
    name: commandName(callback.actionId),
    actor,
    args: commandArgs(callback),
    source: { provider: "dingtalk" },
    issuedAt,
  };
}
