import type { ExternalIdentity, IdentityResolver, UsoraActor } from "@usora/integration";
import type { DingTalkCallback } from "./callback.ts";

export type DingTalkIdentityInput = {
  userId: string;
  corpId?: string;
  displayName?: string;
};

export type DingTalkActorMapping = Record<string, string>;

function identityKey(userId: string, corpId?: string): string {
  return `${corpId || ""}:${userId}`;
}

export function dingTalkExternalIdentity(input: DingTalkIdentityInput): ExternalIdentity {
  return {
    provider: "dingtalk",
    externalUserId: input.userId,
    ...(input.corpId ? { externalTenantId: input.corpId } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
  };
}

export function dingTalkIdentityFromCallback(callback: DingTalkCallback): DingTalkIdentityInput {
  return {
    userId: callback.userId,
    ...(callback.corpId ? { corpId: callback.corpId } : {}),
  };
}

export function createDingTalkIdentityResolver(mapping: DingTalkActorMapping): IdentityResolver {
  return {
    resolveIdentity(input) {
      if (input.provider !== "dingtalk") return null;
      const userId = mapping[identityKey(input.externalUserId, input.externalTenantId)];
      if (!userId) return null;
      return {
        id: userId,
        kind: "user",
        identities: [
          dingTalkExternalIdentity({
            userId: input.externalUserId,
            ...(input.externalTenantId ? { corpId: input.externalTenantId } : {}),
            ...(input.displayName ? { displayName: input.displayName } : {}),
          }),
        ],
      } satisfies UsoraActor;
    },
  };
}
