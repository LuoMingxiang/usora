import type { IntegrationResource, IntegrationResourceType, ResourceProvenance } from "@usora/integration";

export const DINGTALK_RESOURCE_TYPES = [
  "document",
  "log",
  "todo",
  "conversation",
  "message",
  "calendar",
  "ai-table",
] as const;

export type DingTalkResourceType = (typeof DINGTALK_RESOURCE_TYPES)[number];

export type DingTalkResourceInput = {
  type: DingTalkResourceType;
  id: string;
  title?: string;
  url?: string;
  content?: string;
  corpId?: string;
  conversationId?: string;
  deleted?: boolean;
  inaccessible?: boolean;
  metadata?: Record<string, unknown>;
};

export type DingTalkResourceDiscoveryInput = {
  resources: DingTalkResourceInput[];
  q?: string;
  type?: DingTalkResourceType;
  scope?: { corpId?: string; conversationId?: string };
  permissions?: string[];
};

const TYPE_MAP: Record<DingTalkResourceType, IntegrationResourceType> = {
  document: "document",
  log: "log",
  todo: "todo",
  conversation: "conversation",
  message: "message",
  calendar: "calendar",
  "ai-table": "document",
};

export function mapDingTalkResource(input: DingTalkResourceInput): IntegrationResource {
  return {
    provider: "dingtalk",
    type: TYPE_MAP[input.type],
    externalId: input.id,
    ...(input.url ? { url: input.url } : {}),
    ...(input.title ? { title: input.title } : {}),
    metadata: {
      dingtalkType: input.type,
      ...(input.corpId ? { corpId: input.corpId } : {}),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...input.metadata,
    },
  };
}

export function createDingTalkResourceProvenance(
  resource: DingTalkResourceInput,
  capturedBy?: string,
  capturedAt = new Date().toISOString(),
): ResourceProvenance {
  return {
    resource: mapDingTalkResource(resource),
    capturedAt,
    ...(capturedBy ? { capturedBy } : {}),
  };
}

export function discoverDingTalkResources(input: DingTalkResourceDiscoveryInput): IntegrationResource[] {
  const permissions = new Set(input.permissions || []);
  if (!permissions.has("resource.read")) return [];
  const query = input.q?.toLowerCase();
  return input.resources
    .filter((resource) => !input.type || resource.type === input.type)
    .filter((resource) => !input.scope?.corpId || resource.corpId === input.scope.corpId)
    .filter((resource) => !input.scope?.conversationId || resource.conversationId === input.scope.conversationId)
    .filter(
      (resource) =>
        !query || [resource.id, resource.title, resource.url].some((value) => value?.toLowerCase().includes(query)),
    )
    .map(mapDingTalkResource);
}

export function readDingTalkResource(
  resource: DingTalkResourceInput,
  capturedBy?: string,
  capturedAt = new Date().toISOString(),
): { content: string; metadata: Record<string, unknown>; provenance: ResourceProvenance } | null {
  if (resource.deleted || resource.inaccessible) return null;
  return {
    content: resource.content || "",
    metadata: {
      dingtalkType: resource.type,
      ...(resource.corpId ? { corpId: resource.corpId } : {}),
      ...(resource.conversationId ? { conversationId: resource.conversationId } : {}),
      ...resource.metadata,
    },
    provenance: createDingTalkResourceProvenance(resource, capturedBy, capturedAt),
  };
}
