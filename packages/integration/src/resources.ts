export const INTEGRATION_RESOURCE_TYPES = [
  "document",
  "message",
  "conversation",
  "todo",
  "log",
  "calendar",
  "user",
  "group",
  "card",
] as const;

export type IntegrationResourceType = (typeof INTEGRATION_RESOURCE_TYPES)[number] | (string & {});

export type IntegrationResource = {
  provider: string;
  type: IntegrationResourceType;
  externalId: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type ResourceProvenance = {
  resource: IntegrationResource;
  capturedAt: string;
  capturedBy?: string;
};

export function createResourceProvenance(
  resource: IntegrationResource,
  capturedBy?: string,
  capturedAt = new Date().toISOString(),
): ResourceProvenance {
  return {
    resource,
    capturedAt,
    ...(capturedBy ? { capturedBy } : {}),
  };
}
