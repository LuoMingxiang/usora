import {
  dispatchIntegrationCommand,
  withIntegrationLock,
  type Authorizer,
  type IdentityResolver,
  type IntegrationCommandRegistry,
} from "@usora/integration";
import { createDingTalkActionCommand } from "./actions.ts";
import { claimDingTalkCallback, type DingTalkCallback } from "./callback.ts";
import { readDingTalkCallbackReceipt, dingTalkCallbackReceiptFile } from "./callback.ts";
import path from "node:path";

export type DingTalkDispatchInput = {
  callback: DingTalkCallback;
  stateDir: string;
  identities: IdentityResolver;
  authorizer: Authorizer;
  commands: IntegrationCommandRegistry;
  now?: string;
};

export async function dispatchDingTalkCallback(input: DingTalkDispatchInput) {
  const actor = await input.identities.resolveIdentity({
    provider: "dingtalk",
    externalUserId: input.callback.userId,
    ...(input.callback.corpId ? { externalTenantId: input.callback.corpId } : {}),
  });
  if (!actor) return { ok: false as const, error: "Unmapped DingTalk user", code: "UNMAPPED_USER" };

  const decision = await input.authorizer.authorize({ actor, permission: input.callback.actionId });
  if (!decision.allowed)
    return { ok: false as const, error: decision.reason || "Permission denied", code: "PERMISSION_DENIED" };

  return withIntegrationLock(path.join(input.stateDir, "callback-dispatch"), async () => {
    if (await readDingTalkCallbackReceipt(dingTalkCallbackReceiptFile(input.stateDir, input.callback.id))) {
      return { ok: false as const, error: "duplicate callback", code: "DUPLICATE_CALLBACK" };
    }
    const result = await dispatchIntegrationCommand(
      input.commands,
      createDingTalkActionCommand(input.callback, actor, input.now),
    );
    if (result.ok) await claimDingTalkCallback(input.stateDir, input.callback, input.now);
    return result;
  });
}
