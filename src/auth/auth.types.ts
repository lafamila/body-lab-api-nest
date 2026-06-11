export interface AuthAccount {
  accountId: string;
  subject: string;
  serviceKey: string;
  permission: string;
  claims: Record<string, unknown>;
}

export interface RequestWithAuth {
  authAccount: AuthAccount;
}
