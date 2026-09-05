import {
  dispatchIntegrationCommand,
  type Authorizer,
  type IdentityResolver,
  type IntegrationCommandRegistry,
} from "@usora/integration";
import { createDingTalkActionCommand } from "./actions.ts";
import { claimDingTalkCallback, type DingTalkCallback } from "./callback.ts";

export type DingTalkDispatchInput = {
  callback: DingTalkCallback;
  stateDir: string;
  identities: IdentityResolver;
  authorizer: Authorizer;
  commands: IntegrationCommandRegistry;
  now?: string;
};

export async function dispatchDingTalkCallback(input: DingTalkDispatchInput) {
  const claim = await claimDingTalkCallback(input.stateDir, input.callback, input.now);
  if (!claim.ok) return { ok: false as const, error: claim.error, code: "DUPLICATE_CALLBACK" };

  const actor = await input.identities.resolveIdentity({
    provider: "dingtalk",
    externalUserId: input.callback.userId,
    ...(input.callback.corpId ? { externalTenantId: input.callback.corpId } : {}),
  });
  if (!actor) return { ok: false as const, error: "Unmapped DingTalk user", code: "UNMAPPED_USER" };

  const decision = await input.authorizer.authorize({ actor, permission: input.callback.actionId });
  if (!decision.allowed)
    return { ok: false as const, error: decision.reason || "Permission denied", code: "PERMISSION_DENIED" };

  return dispatchIntegrationCommand(input.commands, createDingTalkActionCommand(input.callback, actor, input.now));
}
