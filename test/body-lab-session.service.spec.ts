import { UnauthorizedException } from '@nestjs/common';
import { BodyLabSessionService } from '../src/auth/body-lab-session.service';
import { AuthService } from '../src/auth/auth.service';
import { BodyLabConfigService } from '../src/config/config.service';

function config(): BodyLabConfigService {
  return new BodyLabConfigService({
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 3020,
    publicBaseUrl: 'http://localhost:3020',
    lanBaseUrl: 'http://192.168.0.10:3020',
    productionBaseUrl: 'https://lab.lafamila.xyz',
    databaseUrl: 'postgres://test',
    databaseSsl: false,
    redisKeyPrefix: 'body-lab',
    authIssuerUrl: 'https://auth.example.test',
    authAudience: 'service:body-lab',
    authServiceKey: 'body-lab',
    authDeniedPermissions: ['visitor'],
    authApiBaseUrl: 'https://auth.example.test',
    oidcClientId: 'body-lab-api',
    oidcClientSecret: 'client-secret',
    oidcRedirectUri: 'http://localhost:3020/session/oidc/callback',
    oidcLoginTransactionTtlSeconds: 300,
    sessionCookieName: 'body_lab_session',
    sessionMaxAgeSeconds: 3600,
    localTimeZone: 'Asia/Seoul',
  });
}

function authService(): jest.Mocked<Pick<AuthService, 'verifyBearerToken'>> {
  return {
    verifyBearerToken: jest.fn().mockResolvedValue({
      accountId: 'account-1',
      subject: 'account-1',
      serviceKey: 'body-lab',
      permission: 'owner',
      claims: {},
    }),
  };
}

describe('BodyLabSessionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('starts OIDC login with body-lab-api confidential client settings', () => {
    const service = new BodyLabSessionService(config(), authService() as unknown as AuthService);

    const started = service.startOidcLogin({
      clientKind: 'ios',
      clientInstanceId: 'device-1',
      deviceName: 'iPhone',
      returnUri: 'bodylab://auth/callback',
    });
    const authorizeUrl = new URL(started.authorizeUrl);

    expect(started.loginTransactionId).toHaveLength(43);
    expect(authorizeUrl.origin).toBe('https://auth.example.test');
    expect(authorizeUrl.pathname).toBe('/oauth/authorize');
    expect(authorizeUrl.searchParams.get('client_id')).toBe('body-lab-api');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3020/session/oidc/callback');
    expect(authorizeUrl.searchParams.get('redirect_uri')).not.toBe('bodylab://auth/callback');
    expect(authorizeUrl.searchParams.get('scope')).toBe('openid profile email service.permission');
    expect(authorizeUrl.searchParams.get('state')).toBeTruthy();
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(started.authorizeUrl).not.toContain('client-secret');
  });

  it('creates and consumes an opaque body-lab session after callback token exchange', async () => {
    const auth = authService();
    const service = new BodyLabSessionService(config(), auth as unknown as AuthService);
    const tokenFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
      }),
    } as Response);
    global.fetch = tokenFetch as typeof fetch;

    const started = service.startOidcLogin({ returnUri: 'bodylab://auth/callback' });
    const state = new URL(started.authorizeUrl).searchParams.get('state') ?? '';
    const callback = await service.completeOidcCallback({ code: 'code-1', state });
    const completed = service.completeOidcLogin(started.loginTransactionId);

    expect(callback.redirectUri).toContain('bodylab://auth/callback');
    expect(callback.redirectUri).toContain('status=success');
    expect(callback.redirectUri).toContain(`loginTransactionId=${started.loginTransactionId}`);
    expect(callback.redirectUri).not.toContain(encodeURIComponent('http://localhost:3020/session/oidc/callback'));
    expect(callback.session?.sessionId).toBe(completed.sessionId);
    expect(callback.session).not.toHaveProperty('accessToken');
    expect(callback.session).not.toHaveProperty('refreshToken');
    expect(completed.user.permission).toBe('owner');
    expect(auth.verifyBearerToken).toHaveBeenCalledWith('access-1');
    expect(tokenFetch).toHaveBeenCalledWith(
      'https://auth.example.test/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"client_id":"body-lab-api"'),
      }),
    );
    expect(() => service.completeOidcLogin(started.loginTransactionId)).toThrow(UnauthorizedException);
  });

  it('passes hosted auth callback denial to the native return URI with a machine-readable error code', async () => {
    const service = new BodyLabSessionService(config(), authService() as unknown as AuthService);
    const started = service.startOidcLogin({ returnUri: 'bodylab://auth/callback' });
    const state = new URL(started.authorizeUrl).searchParams.get('state') ?? '';

    const callback = await service.completeOidcCallback({
      state,
      error: 'access_denied',
      errorDescription: 'body-lab permission is required',
    });

    expect(callback.errorCode).toBe('access_denied');
    expect(callback.error).toBe('body-lab permission is required');
    const redirectUri = new URL(callback.redirectUri ?? '');
    expect(`${redirectUri.protocol}//${redirectUri.host}${redirectUri.pathname}`).toBe('bodylab://auth/callback');
    expect(redirectUri.searchParams.get('loginTransactionId')).toBe(started.loginTransactionId);
    expect(redirectUri.searchParams.get('status')).toBe('error');
    expect(redirectUri.searchParams.get('errorCode')).toBe('access_denied');
    expect(redirectUri.searchParams.get('error')).toBe('body-lab permission is required');
    expect(() => service.completeOidcLogin(started.loginTransactionId)).toThrow(UnauthorizedException);
  });

  it('rejects completing before the auth callback finishes', () => {
    const service = new BodyLabSessionService(config(), authService() as unknown as AuthService);
    const started = service.startOidcLogin({});

    expect(() => service.completeOidcLogin(started.loginTransactionId)).toThrow(UnauthorizedException);
  });

  it('records callback failure when token validation rejects visitor access', async () => {
    const auth = authService();
    auth.verifyBearerToken.mockRejectedValue(new UnauthorizedException('body-lab non-visitor permission is required'));
    const service = new BodyLabSessionService(config(), auth as unknown as AuthService);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'visitor-access',
        refresh_token: 'refresh-1',
        expires_in: 3600,
      }),
    } as Response) as typeof fetch;

    const started = service.startOidcLogin({ returnUri: 'bodylab://auth/callback' });
    const state = new URL(started.authorizeUrl).searchParams.get('state') ?? '';
    const callback = await service.completeOidcCallback({ code: 'code-1', state });

    expect(callback.errorCode).toBe('access_denied');
    expect(callback.error).toContain('body-lab non-visitor permission is required');
    expect(callback.redirectUri).toContain('status=error');
    expect(callback.redirectUri).toContain('errorCode=access_denied');
    expect(() => service.completeOidcLogin(started.loginTransactionId)).toThrow(UnauthorizedException);
  });
});
