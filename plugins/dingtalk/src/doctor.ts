import {
  assertProviderContract,
  deadLetterDiagnostic,
  type AuthorizationDecision,
  type DeliveryRecord,
  type IntegrationCheckpoint,
  type IntegrationProvider,
  type RetryConfig,
} from "@usora/integration";
import { type DingTalkConfig, redactDingTalkConfig } from "./config.ts";

export type DingTalkDoctorInput = {
  config: DingTalkConfig;
  provider?: IntegrationProvider;
  auth?: AuthorizationDecision;
  checkpoint?: IntegrationCheckpoint | null;
  deliveries?: DeliveryRecord[];
  deadLetters?: DeliveryRecord[];
  retry?: RetryConfig;
};

export function doctorDingTalkIntegration(input: DingTalkDoctorInput) {
  const provider = providerStatus(input.provider);
  const deliveries = input.deliveries || [];
  const deadLetters = input.deadLetters || [];
  const lastSuccess = latestDelivery(deliveries, ["delivered"]);
  const lastFailure = latestDelivery([...deliveries, ...deadLetters], ["failed", "dead-letter"]);

  return {
    ok: input.config.enabled && provider.ok && input.auth?.allowed !== false && deadLetters.length === 0,
    provider,
    config: redactDingTalkConfig(input.config),
    auth: input.auth ?? null,
    lastSuccess,
    lastFailure,
    checkpoint: input.checkpoint ?? null,
    retry: input.retry ?? null,
    deadLetter: {
      count: deadLetters.length,
      diagnostics: deadLetters.map(deadLetterDiagnostic),
    },
  };
}

function providerStatus(provider: IntegrationProvider | undefined) {
  if (!provider) return { ok: false, error: "DingTalk provider is not registered" };
  try {
    assertProviderContract(provider);
    return {
      ok: provider.enabled !== false,
      id: provider.id,
      enabled: provider.enabled !== false,
      capabilities: provider.capabilities,
    };
  } catch (error) {
    return { ok: false, id: provider.id, error: error instanceof Error ? error.message : String(error) };
  }
}

function latestDelivery(deliveries: DeliveryRecord[], statuses: DeliveryRecord["status"][]) {
  return (
    deliveries
      .filter((delivery) => statuses.includes(delivery.status))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}
