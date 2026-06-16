import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPair, SignJWT } from 'jose';
import { AuthService } from '../src/auth/auth.service';
import { BodyLabConfigService } from '../src/config/config.service';

function config(): BodyLabConfigService {
  return new BodyLabConfigService({
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 3020,
    publicBaseUrl: 'http://localhost:3020',
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
    oidcRedirectUri: 'http://localhost:3020/session/oidc/callback',
    oidcLoginTransactionTtlSeconds: 300,
    sessionCookieName: 'body_lab_session',
    sessionMaxAgeSeconds: 3600,
    localTimeZone: 'Asia/Seoul',
  });
}

describe('AuthService', () => {
  it('accepts owner permission for the body-lab service claim', () => {
    const service = new AuthService(config());

    const account = service.validatePayload({
      iss: 'https://auth.example.test',
      aud: 'service:body-lab',
      sub: 'account-1',
      'body-lab': 'owner',
    });

    expect(account.accountId).toBe('account-1');
    expect(account.permission).toBe('owner');
  });

  it('accepts non-visitor permission for the body-lab service claim', () => {
    const service = new AuthService(config());

    const account = service.validatePayload({
      iss: 'https://auth.example.test',
      aud: 'service:body-lab',
      sub: 'account-1',
      'body-lab': 'member',
    });

    expect(account.accountId).toBe('account-1');
    expect(account.permission).toBe('member');
  });

  it('rejects visitor permission', () => {
    const service = new AuthService(config());

    expect(() =>
      service.validatePayload({
        sub: 'account-1',
        'body-lab': 'visitor',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing body-lab service claim', () => {
    const service = new AuthService(config());

    expect(() =>
      service.validatePayload({
        sub: 'account-1',
        services: { other: 'owner' },
      }),
    ).toThrow(UnauthorizedException);
  });

  it('accepts auth-api namespaced service claim', () => {
    const service = new AuthService(config());

    const account = service.validatePayload({
      sub: 'account-1',
      'https://lafamila.xyz/claims/service': {
        key: 'body-lab',
        permission: 'owner',
        permissionSchemaVersion: 2,
      },
    });

    expect(account.accountId).toBe('account-1');
    expect(account.permission).toBe('owner');
  });

  it('rejects wrong audience during signature validation', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const service = new AuthService(config());
    service['jwks'] = async () => publicKey;
    const token = await new SignJWT({ 'body-lab': 'owner' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://auth.example.test')
      .setAudience('service:other')
      .setSubject('account-1')
      .setExpirationTime('2h')
      .sign(privateKey);

    await expect(service.verifyBearerToken(token)).rejects.toThrow();
  });

  it('accepts signed token with service permission object array claim', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const service = new AuthService(config());
    service['jwks'] = async () => publicKey;
    const token = await new SignJWT({
      permissions: [{ serviceKey: 'body-lab', permission: 'owner' }],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://auth.example.test')
      .setAudience('service:body-lab')
      .setSubject('account-1')
      .setExpirationTime('2h')
      .sign(privateKey);

    await expect(service.verifyBearerToken(token)).resolves.toMatchObject({
      accountId: 'account-1',
      permission: 'owner',
    });
  });
});
