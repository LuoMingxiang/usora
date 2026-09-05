import type { Authorizer } from "@usora/integration";

export const DINGTALK_READ_PERMISSIONS = [
  "hub.status",
  "candidate.view",
  "candidate.list",
  "candidate.get",
  "governance.scan",
  "skill.get",
  "digest.get",
  "foundry.run",
] as const;
export const DINGTALK_CANDIDATE_PERMISSIONS = ["candidate.approve", "candidate.reject"] as const;
export const DINGTALK_GOVERNANCE_PERMISSIONS = [
  "governance.keep",
  "governance.evolve",
  "governance.deprecate",
  "governance.retire",
] as const;
export const DINGTALK_MAINTAINER_PERMISSIONS = ["governance.deprecate", "governance.retire"] as const;

function includes(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

export function createDingTalkAuthorizer(maintainerId: string): Authorizer {
  return {
    authorize({ actor, permission }) {
      if (includes(DINGTALK_MAINTAINER_PERMISSIONS, permission) && actor.id !== maintainerId) {
        return { allowed: false, reason: "Only the configured Maintainer can perform this action" };
      }
      if (
        includes(DINGTALK_READ_PERMISSIONS, permission) ||
        includes(DINGTALK_CANDIDATE_PERMISSIONS, permission) ||
        includes(DINGTALK_GOVERNANCE_PERMISSIONS, permission)
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: `Unknown DingTalk permission: ${permission}` };
    },
  };
}
