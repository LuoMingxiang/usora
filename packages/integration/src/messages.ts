import type { IntegrationResource } from "./resources.ts";

export type IntegrationMessageFact = {
  label: string;
  value: string;
};

export type IntegrationAction = {
  id: string;
  label: string;
  command?: string;
  style?: "default" | "primary" | "danger";
  metadata?: Record<string, unknown>;
};

export type IntegrationMessageSection = {
  title?: string;
  body?: string;
  facts?: IntegrationMessageFact[];
};

export type IntegrationMessage = {
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  sections?: IntegrationMessageSection[];
  actions?: IntegrationAction[];
  resources?: IntegrationResource[];
  metadata?: Record<string, unknown>;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function messageHasContent(message: IntegrationMessage): boolean {
  return (
    hasText(message.title) ||
    hasText(message.summary) ||
    hasText(message.body) ||
    Boolean(message.sections?.some((section) => hasText(section.title) || hasText(section.body)))
  );
}

export function validateIntegrationMessage(message: IntegrationMessage): IntegrationMessage {
  if (!messageHasContent(message)) throw Error("IntegrationMessage must include title, summary, body, or section text");
  for (const action of message.actions || []) {
    if (!hasText(action.id) || !hasText(action.label)) throw Error("IntegrationAction must include id and label");
  }
  return message;
}
