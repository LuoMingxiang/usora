import {
  assertProviderContract,
  createProviderRegistry,
  type IntegrationProvider,
  type MessagingCapability,
  type ProviderRegistry,
} from "@usora/integration";

export const DINGTALK_PROVIDER_ID = "dingtalk";

export function createDingTalkProvider(messaging: MessagingCapability): IntegrationProvider {
  return assertProviderContract({
    id: DINGTALK_PROVIDER_ID,
    capabilities: { messaging: true },
    messaging,
  });
}

export function createDingTalkProviderRegistry(provider: IntegrationProvider): ProviderRegistry {
  return createProviderRegistry([assertDingTalkStartup(provider)]);
}

export function assertDingTalkStartup(provider: IntegrationProvider): IntegrationProvider {
  const valid = assertProviderContract(provider);
  if (valid.id !== DINGTALK_PROVIDER_ID) throw Error(`DingTalk provider id must be ${DINGTALK_PROVIDER_ID}`);
  if (!valid.capabilities.messaging || !valid.messaging) throw Error("DingTalk provider requires messaging capability");
  return valid;
}
