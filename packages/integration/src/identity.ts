export type UsoraActor = {
  id: string;
  kind: "user" | "agent" | "system";
  identities?: ExternalIdentity[];
};

export type ExternalIdentity = {
  provider: string;
  externalUserId: string;
  externalTenantId?: string;
  displayName?: string;
};

export type IdentityResolutionInput = {
  provider: string;
  externalUserId: string;
  externalTenantId?: string;
  displayName?: string;
};

export type IdentityResolver = {
  resolveIdentity(input: IdentityResolutionInput): Promise<UsoraActor | null> | UsoraActor | null;
};

export type AuthorizationContext = {
  actor: UsoraActor;
  permission: string;
  resource?: string;
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason?: string;
};

export type Authorizer = {
  authorize(context: AuthorizationContext): Promise<AuthorizationDecision> | AuthorizationDecision;
};

export function hasExternalIdentity(actor: UsoraActor, identity: IdentityResolutionInput): boolean {
  return Boolean(
    actor.identities?.some(
      (item) =>
        item.provider === identity.provider &&
        item.externalUserId === identity.externalUserId &&
        (identity.externalTenantId === undefined || item.externalTenantId === identity.externalTenantId),
    ),
  );
}

export function createMaintainerAuthorizer(maintainerId: string, destructivePermissions: Iterable<string>): Authorizer {
  const destructive = new Set(destructivePermissions);
  return {
    authorize({ actor, permission }) {
      if (!destructive.has(permission)) return { allowed: true };
      return actor.id === maintainerId
        ? { allowed: true }
        : { allowed: false, reason: "Only the configured Maintainer can perform this action" };
    },
  };
}
