import type { IntegrationCommand, IntegrationCommandResult, IntegrationMessage } from "@usora/integration";

function facts(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).map(([label, value]) => ({
    label,
    value:
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
  }));
}

function countOf(data: unknown, key: string): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : null;
}

export function createDingTalkBotResponse(
  command: IntegrationCommand,
  result: IntegrationCommandResult,
): IntegrationMessage {
  if (!result.ok) {
    const denied = result.code === "PERMISSION_DENIED";
    return {
      title: denied ? "Permission denied" : "Command failed",
      summary: result.error,
      sections: [{ title: command.name, facts: result.code ? [{ label: "Code", value: result.code }] : [] }],
    };
  }

  const listCount =
    countOf(result.data, "candidates") ?? countOf(result.data, "skills") ?? countOf(result.data, "findings");
  if (command.name === "hub.status") {
    return {
      title: "Usora Status",
      summary: "Current Usora status.",
      sections: [{ title: "Status", facts: facts(result.data) }],
    };
  }
  if (listCount !== null) {
    return {
      title: "Usora Results",
      summary: `${listCount} item(s) found.`,
      sections: [{ title: command.name, facts: facts(result.data) }],
    };
  }
  return {
    title: "Usora Detail",
    summary: `${command.name} completed.`,
    sections: [{ title: command.name, facts: facts(result.data) }],
  };
}
