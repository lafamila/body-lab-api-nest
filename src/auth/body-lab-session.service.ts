import { randomBytes, createHash } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { BodyLabConfigService } from '../config/config.service';
import { AuthAccount } from './auth.types';
import { AuthService } from './auth.service';
import { OidcStartLoginDto } from './session.dto';

interface BodyLabSession {
  id: string;
  account: AuthAccount;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  clientKind?: 'ios' | 'mac';
  clientInstanceId?: string;
  deviceName?: string;
  createdAt: number;
  lastSeenAt: number;
}

interface LoginTransaction {
  id: string;
  state: string;
  verifier: string;
  codeChallenge: string;
  clientKind?: 'ios' | 'mac';
  clientInstanceId?: string;
  deviceName?: string;
  returnUri?: string;
  expiresAt: number;
  status: 'pending' | 'completed' | 'failed' | 'consumed';
  sessionId?: string;
  errorCode?: string;
  error?: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface SessionResponse {
  sessionId: string;
  user: AuthAccount;
  expiresAt: string;
}

@Injectable()
export class BodyLabSessionService {
  private readonly sessions = new Map<string, BodyLabSession>();
  private readonly loginTransactions = new Map<string, LoginTransaction>();

  constructor(
    private readonly config: BodyLabConfigService,
    private readonly authService: AuthService,
  ) {}

  startOidcLogin(input: OidcStartLoginDto): {
    authorizeUrl: string;
    loginTransactionId: string;
    expiresAt: string;
  } {
    const returnUri = this.normalizeReturnUri(input.returnUri);
    const verifier = randomToken(48);
    const transaction: LoginTransaction = {
      id: randomToken(32),
      state: randomToken(32),
      verifier,
      codeChallenge: pkceChallenge(verifier),
      clientKind: input.clientKind,
      clientInstanceId: input.clientInstanceId,
      deviceName: input.deviceName,
      returnUri,
      expiresAt: Date.now() + this.config.oidcLoginTransactionTtlSeconds * 1000,
      status: 'pending',
    };
    this.loginTransactions.set(transaction.id, transaction);
    return {
      authorizeUrl: this.buildAuthorizeUrl(transaction),
      loginTransactionId: transaction.id,
      expiresAt: new Date(transaction.expiresAt).toISOString(),
    };
  }

  async completeOidcCallback(input: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<{ loginTransactionId?: string; redirectUri?: string; session?: SessionResponse; error?: string; errorCode?: string }> {
    const transaction = this.findTransactionByState(input.state);
    if (!transaction) {
      return { errorCode: 'invalid_state', error: 'Invalid or expired login state' };
    }
    if (input.error) {
      transaction.status = 'failed';
      transaction.errorCode = input.error;
      transaction.error = input.errorDescription ?? input.error;
      return {
        loginTransactionId: transaction.id,
        redirectUri: this.returnUriWithResult(transaction, 'error', transaction.errorCode, transaction.error),
        errorCode: transaction.errorCode,
        error: transaction.error,
      };
    }
    if (!input.code) {
      transaction.status = 'failed';
      transaction.errorCode = 'authorization_code_missing';
      transaction.error = 'Authorization code missing';
      return {
        loginTransactionId: transaction.id,
        redirectUri: this.returnUriWithResult(transaction, 'error', transaction.errorCode, transaction.error),
        errorCode: transaction.errorCode,
        error: transaction.error,
      };
    }
    try {
      const token = await this.requestToken({
        grant_type: 'authorization_code',
        client_id: this.config.oidcClientId,
        client_secret: this.config.oidcClientSecret,
        redirect_uri: this.config.oidcRedirectUri,
        code: input.code,
        code_verifier: transaction.verifier,
      });
      const session = await this.createSession(token, transaction);
      this.sessions.set(session.id, session);
      transaction.status = 'completed';
      transaction.sessionId = session.id;
      return {
        loginTransactionId: transaction.id,
        redirectUri: this.returnUriWithResult(transaction, 'success'),
        session: this.toSessionResponse(session),
      };
    } catch (error) {
      transaction.status = 'failed';
      transaction.errorCode = this.callbackErrorCode(error);
      transaction.error = error instanceof Error ? error.message : 'Login failed';
      return {
        loginTransactionId: transaction.id,
        redirectUri: this.returnUriWithResult(transaction, 'error', transaction.errorCode, transaction.error),
        errorCode: transaction.errorCode,
        error: transaction.error,
      };
    }
  }

  completeOidcLogin(loginTransactionId: string): SessionResponse {
    const transaction = this.loginTransactions.get(loginTransactionId);
    if (!transaction || transaction.expiresAt <= Date.now()) {
      if (transaction) {
        this.loginTransactions.delete(loginTransactionId);
      }
      throw new UnauthorizedException('Login transaction expired');
    }
    if (transaction.status === 'failed') {
      this.loginTransactions.delete(loginTransactionId);
      throw new UnauthorizedException(transaction.error ?? 'Login failed');
    }
    if (transaction.status !== 'completed' || !transaction.sessionId) {
      throw new UnauthorizedException('Login transaction is not complete');
    }
    const session = this.sessions.get(transaction.sessionId);
    if (!session) {
      this.loginTransactions.delete(loginTransactionId);
      throw new UnauthorizedException('Body-lab session is no longer available');
    }
    transaction.status = 'consumed';
    this.loginTransactions.delete(loginTransactionId);
    return this.toSessionResponse(session);
  }

  async requireSession(sessionId: string | undefined): Promise<BodyLabSession> {
    if (!sessionId) {
      throw new UnauthorizedException('Body-lab session is required');
    }
    let session = this.sessions.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Body-lab session is required');
    }
    if (Date.now() - session.lastSeenAt > this.config.sessionMaxAgeSeconds * 1000) {
      this.sessions.delete(sessionId);
      throw new UnauthorizedException('Body-lab session expired');
    }
    if (session.accessTokenExpiresAt - Date.now() <= 30_000) {
      session = await this.refreshSession(session);
      this.sessions.set(session.id, session);
    }
    session.lastSeenAt = Date.now();
    return session;
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      return;
    }
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    if (session?.refreshToken) {
      await fetch(`${this.config.authApiBaseUrl}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.refreshToken }),
      }).catch(() => undefined);
    }
  }

  private buildAuthorizeUrl(transaction: LoginTransaction): string {
    const url = new URL(`${this.config.authApiBaseUrl}/oauth/authorize`);
    url.searchParams.set('client_id', this.config.oidcClientId);
    url.searchParams.set('redirect_uri', this.config.oidcRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile email service.permission');
    url.searchParams.set('state', transaction.state);
    url.searchParams.set('code_challenge', transaction.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  private findTransactionByState(state: string | undefined): LoginTransaction | undefined {
    if (!state) {
      return undefined;
    }
    for (const transaction of this.loginTransactions.values()) {
      if (transaction.expiresAt <= Date.now()) {
        this.loginTransactions.delete(transaction.id);
        continue;
      }
      if (transaction.state === state && transaction.status === 'pending') {
        return transaction;
      }
    }
    return undefined;
  }

  private async requestToken(body: Record<string, string | undefined>): Promise<TokenResponse> {
    const clean = Object.fromEntries(Object.entries(body).filter(([, value]) => typeof value !== 'undefined'));
    const response = await fetch(`${this.config.authApiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });
    if (!response.ok) {
      throw new UnauthorizedException(await responseText(response, 'Token exchange failed'));
    }
    return (await response.json()) as TokenResponse;
  }

  private async createSession(token: TokenResponse, transaction: LoginTransaction): Promise<BodyLabSession> {
    if (!token.access_token || !token.refresh_token || !token.expires_in) {
      throw new UnauthorizedException('Invalid token response');
    }
    const account = await this.authService.verifyBearerToken(token.access_token);
    const now = Date.now();
    return {
      id: randomToken(32),
      account,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: now + token.expires_in * 1000,
      clientKind: transaction.clientKind,
      clientInstanceId: transaction.clientInstanceId,
      deviceName: transaction.deviceName,
      createdAt: now,
      lastSeenAt: now,
    };
  }

  private async refreshSession(session: BodyLabSession): Promise<BodyLabSession> {
    try {
      const token = await this.requestToken({
        grant_type: 'refresh_token',
        client_id: this.config.oidcClientId,
        client_secret: this.config.oidcClientSecret,
        refresh_token: session.refreshToken,
      });
      const transaction: LoginTransaction = {
        id: randomToken(8),
        state: randomToken(8),
        verifier: randomToken(8),
        codeChallenge: randomToken(8),
        clientKind: session.clientKind,
        clientInstanceId: session.clientInstanceId,
        deviceName: session.deviceName,
        expiresAt: Date.now() + this.config.oidcLoginTransactionTtlSeconds * 1000,
        status: 'completed',
      };
      const refreshed = await this.createSession(token, transaction);
      return { ...refreshed, id: session.id, createdAt: session.createdAt };
    } catch (error) {
      this.sessions.delete(session.id);
      throw error;
    }
  }

  private toSessionResponse(session: BodyLabSession): SessionResponse {
    return {
      sessionId: session.id,
      user: session.account,
      expiresAt: new Date(session.lastSeenAt + this.config.sessionMaxAgeSeconds * 1000).toISOString(),
    };
  }

  private normalizeReturnUri(returnUri: string | undefined): string | undefined {
    if (!returnUri) {
      return undefined;
    }
    let parsed: URL;
    try {
      parsed = new URL(returnUri);
    } catch {
      throw new BadRequestException('returnUri must be a valid URL');
    }
    if (parsed.protocol === 'bodylab:' || parsed.protocol === 'bodylab-mac:') {
      return parsed.toString();
    }
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && this.allowedHttpReturnOrigins().has(parsed.origin)) {
      return parsed.toString();
    }
    throw new BadRequestException('returnUri is not allowed');
  }

  private allowedHttpReturnOrigins(): Set<string> {
    return new Set(
      [this.config.publicBaseUrl, this.config.lanBaseUrl, this.config.productionBaseUrl]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => new URL(value).origin),
    );
  }

  private returnUriWithResult(
    transaction: LoginTransaction,
    status: 'success' | 'error',
    errorCode?: string,
    error?: string,
  ): string | undefined {
    if (!transaction.returnUri) {
      return undefined;
    }
    const url = new URL(transaction.returnUri);
    url.searchParams.set('loginTransactionId', transaction.id);
    url.searchParams.set('status', status);
    if (errorCode) {
      url.searchParams.set('errorCode', errorCode);
    }
    if (error) {
      url.searchParams.set('error', error);
    }
    return url.toString();
  }

  private callbackErrorCode(error: unknown): string {
    if (error instanceof UnauthorizedException) {
      const message = error.message.toLowerCase();
      if (message.includes('non-visitor permission') || message.includes('access denied')) {
        return 'access_denied';
      }
      return 'token_exchange_failed';
    }
    return 'login_failed';
  }
}

function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function responseText(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; message?: string; error_description?: string };
    return body.detail ?? body.message ?? body.error_description ?? fallback;
  } catch {
    return fallback;
  }
}
