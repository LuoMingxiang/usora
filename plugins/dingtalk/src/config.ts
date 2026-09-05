import type { IntegrationCapabilities, IntegrationSubscription } from "@usora/integration";

export type DingTalkTransport = "webhook" | "app";

export type DingTalkEnvNames = {
  webhookUrl: string;
  webhookSecret: string;
  appKey: string;
  appSecret: string;
};

export type DingTalkConfigInput = {
  enabled?: boolean;
  transport?: DingTalkTransport;
  capabilities?: IntegrationCapabilities;
  subscriptions?: IntegrationSubscription[];
  env?: Partial<DingTalkEnvNames>;
};

export type DingTalkConfig = {
  enabled: boolean;
  transport: DingTalkTransport;
  capabilities: IntegrationCapabilities;
  subscriptions: IntegrationSubscription[];
  env: DingTalkEnvNames;
  secrets: Partial<Record<keyof DingTalkEnvNames, string>>;
};

export const DEFAULT_DINGTALK_ENV: DingTalkEnvNames = {
  webhookUrl: "DINGTALK_WEBHOOK_URL",
  webhookSecret: "DINGTALK_WEBHOOK_SECRET",
  appKey: "DINGTALK_APP_KEY",
  appSecret: "DINGTALK_APP_SECRET",
};

export function resolveDingTalkConfig(
  input: DingTalkConfigInput = {},
  env: Record<string, string | undefined> = process.env,
): DingTalkConfig {
  const names = { ...DEFAULT_DINGTALK_ENV, ...input.env };
  const enabled = input.enabled ?? false;
  const transport = input.transport ?? "webhook";
  const secrets: DingTalkConfig["secrets"] = {};
  const webhookUrl = env[names.webhookUrl];
  const webhookSecret = env[names.webhookSecret];
  const appKey = env[names.appKey];
  const appSecret = env[names.appSecret];
  if (webhookUrl) secrets.webhookUrl = webhookUrl;
  if (webhookSecret) secrets.webhookSecret = webhookSecret;
  if (appKey) secrets.appKey = appKey;
  if (appSecret) secrets.appSecret = appSecret;
  const config: DingTalkConfig = {
    enabled,
    transport,
    capabilities: input.capabilities ?? { messaging: true },
    subscriptions: input.subscriptions ?? [],
    env: names,
    secrets,
  };

  if (enabled && transport === "webhook" && !config.secrets.webhookUrl) {
    throw Error(`${names.webhookUrl} is required when DingTalk webhook transport is enabled`);
  }
  if (enabled && transport === "app" && (!config.secrets.appKey || !config.secrets.appSecret)) {
    throw Error(`${names.appKey} and ${names.appSecret} are required when DingTalk app transport is enabled`);
  }
  return config;
}

export function redactDingTalkConfig(config: DingTalkConfig): DingTalkConfig {
  const secrets = Object.fromEntries(Object.keys(config.secrets).map((key) => [key, "[REDACTED]"]));
  return { ...config, secrets };
}
