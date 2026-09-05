import type { IntegrationCommand, IntegrationCommandResult } from "./commands.ts";
import type { IdentityResolver } from "./identity.ts";
import type { IntegrationMessage } from "./messages.ts";
import type { IntegrationResource } from "./resources.ts";

export type IntegrationCapabilityName = "messaging" | "interaction" | "command" | "source" | "identity" | "resource";

export type IntegrationCapabilities = Partial<Record<IntegrationCapabilityName, boolean>>;

export type MessagingCapability = {
  sendMessage(message: IntegrationMessage): Promise<IntegrationCommandResult> | IntegrationCommandResult;
};

export type InteractionCapability = {
  handleAction(action: unknown): Promise<IntegrationCommandResult> | IntegrationCommandResult;
};

export type CommandCapability = {
  handleCommand(command: IntegrationCommand): Promise<IntegrationCommandResult> | IntegrationCommandResult;
};

export type SourceCapability = {
  capture(resource: IntegrationResource): Promise<IntegrationCommandResult> | IntegrationCommandResult;
};

export type ResourceCapability = {
  getResource(resource: IntegrationResource): Promise<IntegrationResource | null> | IntegrationResource | null;
};

export type IntegrationProvider = {
  id: string;
  enabled?: boolean;
  capabilities: IntegrationCapabilities;
  messaging?: MessagingCapability;
  interaction?: InteractionCapability;
  command?: CommandCapability;
  source?: SourceCapability;
  identity?: IdentityResolver;
  resource?: ResourceCapability;
};

const CAPABILITY_KEYS: IntegrationCapabilityName[] = [
  "messaging",
  "interaction",
  "command",
  "source",
  "identity",
  "resource",
];

export function assertProviderContract(provider: IntegrationProvider): IntegrationProvider {
  if (!provider.id.trim()) throw Error("IntegrationProvider id is required");
  for (const key of CAPABILITY_KEYS) {
    if (provider.capabilities[key] && !provider[key]) throw Error(`Provider ${provider.id} declares missing ${key}`);
  }
  return provider;
}

export type ProviderRegistry = {
  register(provider: IntegrationProvider): IntegrationProvider;
  get(id: string): IntegrationProvider | undefined;
  require(id: string): IntegrationProvider;
  list(capability?: IntegrationCapabilityName): IntegrationProvider[];
};

export function createProviderRegistry(providers: IntegrationProvider[] = []): ProviderRegistry {
  const byId = new Map<string, IntegrationProvider>();
  const registry: ProviderRegistry = {
    register(provider) {
      const valid = assertProviderContract(provider);
      if (byId.has(valid.id)) throw Error(`Duplicate provider: ${valid.id}`);
      byId.set(valid.id, valid);
      return valid;
    },
    get(id) {
      return byId.get(id);
    },
    require(id) {
      const provider = byId.get(id);
      if (!provider) throw Error(`Unknown provider: ${id}`);
      return provider;
    },
    list(capability) {
      return [...byId.values()].filter(
        (provider) => provider.enabled !== false && (!capability || provider.capabilities[capability]),
      );
    },
  };
  providers.forEach(registry.register);
  return registry;
}
