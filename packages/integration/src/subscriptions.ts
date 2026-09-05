import type { UsoraEvent, UsoraEventType } from "./events.ts";
import type { IntegrationMessage } from "./messages.ts";

export type IntegrationSubscription = {
  id: string;
  event: UsoraEventType;
  provider: string;
  message: string;
  enabled?: boolean;
};

export type IntegrationSubscriptionConfig = {
  subscriptions: IntegrationSubscription[];
};

export type MessageBuilder<TData = unknown> = (event: UsoraEvent<TData>) => IntegrationMessage;

export type MessageBuilderRegistry = Map<string, MessageBuilder>;

export type SubscriptionMatch = {
  subscription: IntegrationSubscription;
  event: UsoraEvent;
};

export function matchSubscriptions(event: UsoraEvent, config: IntegrationSubscriptionConfig): SubscriptionMatch[] {
  return config.subscriptions
    .filter((subscription) => subscription.enabled !== false && subscription.event === event.type)
    .map((subscription) => ({ subscription, event }));
}

export function createMessageBuilderRegistry(entries: Iterable<[string, MessageBuilder]> = []): MessageBuilderRegistry {
  return new Map(entries);
}

export function buildSubscriptionMessage(
  match: SubscriptionMatch,
  builders: MessageBuilderRegistry,
): IntegrationMessage {
  const builder = builders.get(match.subscription.message);
  if (!builder) throw Error(`Unknown message builder: ${match.subscription.message}`);
  return builder(match.event);
}
