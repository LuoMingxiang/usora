import { validateIntegrationMessage, type IntegrationAction, type IntegrationMessage } from "@usora/integration";

export type DingTalkPayload =
  | { msgtype: "text"; text: { content: string } }
  | { msgtype: "markdown"; markdown: { title: string; text: string } }
  | { msgtype: "actionCard"; actionCard: { title: string; text: string; btnOrientation: "0"; btns: DingTalkButton[] } };

export type DingTalkButton = {
  title: string;
  actionURL: string;
};

function titleOf(message: IntegrationMessage): string {
  return message.title || message.summary || "Usora";
}

function textOf(message: IntegrationMessage): string {
  const sectionText = message.sections
    ?.map((section) =>
      [section.title, section.body, section.facts?.map((fact) => `- ${fact.label}: ${fact.value}`).join("\n")]
        .filter((part): part is string => Boolean(part))
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
  return [message.title, message.summary, message.body, sectionText]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function actionUrl(action: IntegrationAction): string | null {
  const url = action.metadata?.url;
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
}

export function renderDingTalkText(message: IntegrationMessage): DingTalkPayload {
  const valid = validateIntegrationMessage(message);
  return { msgtype: "text", text: { content: textOf(valid) || titleOf(valid) } };
}

export function renderDingTalkMarkdown(message: IntegrationMessage): DingTalkPayload {
  const valid = validateIntegrationMessage(message);
  const title = titleOf(valid);
  return { msgtype: "markdown", markdown: { title, text: textOf(valid) || title } };
}

export function renderDingTalkCard(message: IntegrationMessage): DingTalkPayload {
  const valid = validateIntegrationMessage(message);
  const btns = (valid.actions || [])
    .map((action) => {
      const url = actionUrl(action);
      return url ? { title: action.label, actionURL: url } : null;
    })
    .filter((button): button is DingTalkButton => Boolean(button));
  if (!btns.length) return renderDingTalkMarkdown(valid);
  return {
    msgtype: "actionCard",
    actionCard: {
      title: titleOf(valid),
      text: textOf(valid) || titleOf(valid),
      btnOrientation: "0",
      btns,
    },
  };
}

export function renderDingTalkWebhookMessage(message: IntegrationMessage): DingTalkPayload {
  return message.actions?.length ? renderDingTalkCard(message) : renderDingTalkMarkdown(message);
}
