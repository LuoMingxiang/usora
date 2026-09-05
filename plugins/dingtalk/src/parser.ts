import type { IntegrationCommandName } from "@usora/integration";

export type DingTalkBotCommand = {
  name: IntegrationCommandName;
  args: Record<string, unknown>;
};

export function parseDingTalkBotCommand(text: string): DingTalkBotCommand | null {
  const parts = text.trim().replace(/^\/+/, "").split(/\s+/).filter(Boolean);
  const [command, ...rest] = parts;
  if (!command) return null;
  if (command === "status") return { name: "hub.status", args: {} };
  if (command === "candidates") return { name: "candidate.list", args: {} };
  if (command === "candidate") return { name: "candidate.get", args: { id: rest[0] } };
  if (command === "skill") return { name: "skill.get", args: { name: rest[0] } };
  if (command === "governance") return { name: "governance.scan", args: {} };
  if (command === "foundry" && rest[0] === "run") return { name: "foundry.run", args: {} };
  if (command === "digest") return { name: "digest.get", args: {} };
  return null;
}
