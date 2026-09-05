import type { Authorizer, UsoraActor } from "./identity.ts";
import type { IntegrationResource } from "./resources.ts";

export const INTEGRATION_COMMAND_NAMES = [
  "hub.status",
  "candidate.list",
  "candidate.get",
  "candidate.approve",
  "candidate.reject",
  "skill.get",
  "governance.scan",
  "governance.resolve",
  "foundry.run",
  "digest.get",
] as const;

export type IntegrationCommandName = (typeof INTEGRATION_COMMAND_NAMES)[number] | (string & {});

export type IntegrationCommand<TArgs = unknown> = {
  id: string;
  name: IntegrationCommandName;
  actor: UsoraActor;
  args: TArgs;
  source: {
    provider: string;
    resource?: IntegrationResource;
  };
  issuedAt: string;
};

export type IntegrationCommandResult<TData = unknown> =
  | { ok: true; data: TData }
  | { ok: false; error: string; code?: string };

export type IntegrationCommandHandler<TArgs = unknown, TData = unknown> = (
  command: IntegrationCommand<TArgs>,
) => Promise<IntegrationCommandResult<TData>> | IntegrationCommandResult<TData>;

export type IntegrationCommandRegistry = Map<string, IntegrationCommandHandler>;

export function createCommandRegistry(
  entries: Iterable<[string, IntegrationCommandHandler]> = [],
): IntegrationCommandRegistry {
  return new Map(entries);
}

export async function dispatchIntegrationCommand<TData = unknown>(
  registry: IntegrationCommandRegistry,
  command: IntegrationCommand,
  authorizer?: Authorizer,
): Promise<IntegrationCommandResult<TData>> {
  const handler = registry.get(command.name);
  if (!handler) return { ok: false, error: `Unknown command: ${command.name}`, code: "UNKNOWN_COMMAND" };

  const decision = await authorizer?.authorize({ actor: command.actor, permission: command.name });
  if (decision && !decision.allowed) {
    return { ok: false, error: decision.reason || "Permission denied", code: "PERMISSION_DENIED" };
  }

  return handler(command) as Promise<IntegrationCommandResult<TData>> | IntegrationCommandResult<TData>;
}
