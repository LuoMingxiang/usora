import type { IntegrationCommandResult, SourceCapability } from "@usora/integration";
import { mapDingTalkResource, readDingTalkResource, type DingTalkResourceInput } from "./resources.ts";

export type DingTalkActivityCaptureInput = {
  source: "dingtalk";
  task: string;
  result: string;
  context: string;
  key_points: string[];
  metadata: Record<string, unknown>;
};

export type DingTalkAutomaticCapturePolicy = {
  allowlist: DingTalkResourceInput["type"][];
  scope?: { corpId?: string; conversationId?: string };
  retentionDays?: number;
  now?: string;
  seenResourceIds?: string[];
  capturedBy?: string;
};

export function normalizeDingTalkResourceActivity(
  resource: DingTalkResourceInput,
  capturedBy?: string,
  capturedAt = new Date().toISOString(),
): DingTalkActivityCaptureInput | null {
  const read = readDingTalkResource(resource, capturedBy, capturedAt);
  if (!read) return null;
  return {
    source: "dingtalk",
    task: `Captured DingTalk ${resource.type}: ${resource.title || resource.id}`,
    result: read.content || resource.title || resource.id,
    context: read.content,
    key_points: [resource.title, read.content].filter((value): value is string => Boolean(value)).slice(0, 2),
    metadata: {
      resource: read.provenance.resource,
      provenance: read.provenance,
    },
  };
}

export function createDingTalkSourceCapability(resources: DingTalkResourceInput[]): SourceCapability {
  return {
    capture(resource): IntegrationCommandResult<DingTalkActivityCaptureInput> {
      const match = resources.find(
        (item) => item.id === resource.externalId && mapDingTalkResource(item).type === resource.type,
      );
      const activity = match ? normalizeDingTalkResourceActivity(match) : null;
      return activity
        ? { ok: true, data: activity }
        : { ok: false, error: "DingTalk resource is unavailable", code: "DINGTALK_RESOURCE_UNAVAILABLE" };
    },
  };
}

export function manualCaptureDingTalkResource(
  resource: DingTalkResourceInput,
  capturedBy: string,
  capturedAt = new Date().toISOString(),
): IntegrationCommandResult<DingTalkActivityCaptureInput> {
  if (!["document", "conversation", "log"].includes(resource.type)) {
    return {
      ok: false,
      error: `Manual capture does not support DingTalk ${resource.type}`,
      code: "DINGTALK_CAPTURE_UNSUPPORTED",
    };
  }
  const activity = normalizeDingTalkResourceActivity(resource, capturedBy, capturedAt);
  return activity
    ? { ok: true, data: activity }
    : { ok: false, error: "DingTalk resource is unavailable", code: "DINGTALK_RESOURCE_UNAVAILABLE" };
}

export function automaticCaptureDingTalkResources(
  resources: DingTalkResourceInput[],
  policy: DingTalkAutomaticCapturePolicy,
): IntegrationCommandResult<DingTalkActivityCaptureInput[]> {
  const allowed = new Set(policy.allowlist);
  const seen = new Set(policy.seenResourceIds || []);
  const capturedAt = policy.now || new Date().toISOString();
  const activities: DingTalkActivityCaptureInput[] = [];

  for (const resource of resources) {
    const dedupKey = `${resource.type}:${resource.id}`;
    if (
      !allowed.has(resource.type) ||
      seen.has(dedupKey) ||
      !matchesAutomaticCaptureScope(resource, policy) ||
      !isWithinAutomaticCaptureRetention(resource, policy) ||
      isPrivateDingTalkResource(resource)
    ) {
      continue;
    }

    const activity = normalizeDingTalkResourceActivity(resource, policy.capturedBy, capturedAt);
    if (activity) {
      seen.add(dedupKey);
      activities.push(activity);
    }
  }

  return { ok: true, data: activities };
}

function matchesAutomaticCaptureScope(
  resource: DingTalkResourceInput,
  policy: DingTalkAutomaticCapturePolicy,
): boolean {
  return (
    (!policy.scope?.corpId || resource.corpId === policy.scope.corpId) &&
    (!policy.scope?.conversationId || resource.conversationId === policy.scope.conversationId)
  );
}

function isWithinAutomaticCaptureRetention(
  resource: DingTalkResourceInput,
  policy: DingTalkAutomaticCapturePolicy,
): boolean {
  if (!policy.retentionDays) return true;
  const value = resource.metadata?.updatedAt || resource.metadata?.createdAt || resource.metadata?.capturedAt;
  if (typeof value !== "string") return true;
  return Date.parse(value) >= Date.parse(policy.now || new Date().toISOString()) - policy.retentionDays * 86_400_000;
}

function isPrivateDingTalkResource(resource: DingTalkResourceInput): boolean {
  return (
    resource.metadata?.private === true ||
    resource.metadata?.sensitive === true ||
    resource.metadata?.visibility === "private"
  );
}
