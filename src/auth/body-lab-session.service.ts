import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BodyLabConfigService } from '../config/config.service';
import { AuthAccount } from './auth.types';
import { AuthService } from './auth.service';
import { SessionLoginDto } from './session.dto';

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

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

@Injectable()
export class BodyLabSessionService {
  private readonly sessions = new Map<string, BodyLabSession>();

  constructor(
    private readonly config: BodyLabConfigService,
    private readonly authService: AuthService,
  ) {}

  async login(input: SessionLoginDto): Promise<{ sessionId: string; user: AuthAccount; expiresAt: string }> {
    const authCookie = await this.createAuthSession(input.loginId, input.password);
    const verifier = randomToken(48);
    const code = await this.authorize(authCookie, pkceChallenge(verifier));
    const token = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.config.oidcClientId,
      client_secret: this.config.oidcClientSecret,
      redirect_uri: this.config.oidcRedirectUri,
      code,
      code_verifier: verifier,
    });
    const session = await this.createSession(token, input);
    this.sessions.set(session.id, session);
    return {
      sessionId: session.id,
      user: session.account,
      expiresAt: new Date(Date.now() + this.config.sessionMaxAgeSeconds * 1000).toISOString(),
    };
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

  private async createAuthSession(loginId: string, password: string): Promise<string> {
    const response = await fetch(`${this.config.authApiBaseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    });
    if (!response.ok) {
      throw new UnauthorizedException(await responseText(response, 'Central login failed'));
    }
    const cookie = response.headers.get('set-cookie');
    if (!cookie) {
      throw new UnauthorizedException('Auth session cookie missing');
    }
    return cookie
      .split(/,(?=[^;]+=)/)
      .map((entry) => entry.split(';', 1)[0])
      .join('; ');
  }

  private async authorize(authCookie: string, codeChallenge: string): Promise<string> {
    const url = new URL(`${this.config.authApiBaseUrl}/oauth/authorize`);
    url.searchParams.set('client_id', this.config.oidcClientId);
    url.searchParams.set('redirect_uri', this.config.oidcRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile email service.permission');
    url.searchParams.set('state', randomToken(12));
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    const response = await fetch(url, {
      method: 'GET',
      headers: { Cookie: authCookie },
      redirect: 'manual',
    });
    const location = response.headers.get('location');
    if (!location) {
      throw new UnauthorizedException(await responseText(response, 'Authorize redirect missing'));
    }
    const redirect = new URL(location);
    const error = redirect.searchParams.get('error_description') ?? redirect.searchParams.get('error');
    if (error) {
      throw new UnauthorizedException(error);
    }
    const code = redirect.searchParams.get('code');
    if (!code) {
      throw new UnauthorizedException('Authorization code missing');
    }
    return code;
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

  private async createSession(token: TokenResponse, input: SessionLoginDto, sessionId?: string): Promise<BodyLabSession> {
    if (!token.access_token || !token.refresh_token || !token.expires_in) {
      throw new UnauthorizedException('Invalid token response');
    }
    const account = await this.authService.verifyBearerToken(token.access_token);
    return {
      id: sessionId ?? randomToken(32),
      account,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
      clientKind: input.clientKind,
      clientInstanceId: input.clientInstanceId,
      deviceName: input.deviceName,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
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
      return this.createSession(
        token,
        {
          loginId: '',
          password: '',
          clientKind: session.clientKind,
          clientInstanceId: session.clientInstanceId,
          deviceName: session.deviceName,
        },
        session.id,
      );
    } catch (error) {
      this.sessions.delete(session.id);
      throw error;
    }
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
