import { firstValueFrom } from 'rxjs';
import { skip, take } from 'rxjs/operators';
import { SyncService } from '../src/sync/sync.service';
import { BodyLabConfigService } from '../src/config/config.service';

describe('SyncService', () => {
  it('hashes account ids for sync channels and emits redis-free readiness smoke event', async () => {
    const service = new SyncService(
      new BodyLabConfigService({
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
        oidcClientId: 'body-lab-mac',
        oidcRedirectUri: 'bodylab-mac://auth/callback',
        sessionCookieName: 'body_lab_session',
        sessionMaxAgeSeconds: 3600,
      }),
    );

    const accountHash = service.accountHash('account-1');
    const event = await firstValueFrom(service.stream('account-1'));

    expect(accountHash).not.toContain('account-1');
    expect(event.data.accountHash).toBe(accountHash);
    expect(event.type).toBe('sync-ready');
  });

  it('broadcasts record sync events without redis in local development', async () => {
    const service = new SyncService(
      new BodyLabConfigService({
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
        oidcClientId: 'body-lab-mac',
        oidcRedirectUri: 'bodylab-mac://auth/callback',
        sessionCookieName: 'body_lab_session',
        sessionMaxAgeSeconds: 3600,
      }),
    );

    const event = firstValueFrom(service.stream('account-1').pipe(skip(1), take(1)));
    await service.publish('account-1', 'days', 'updated', { id: '2026-06-11', updatedAt: 'now' });

    await expect(event).resolves.toMatchObject({
      type: 'sync',
      data: { resource: 'days', action: 'updated', id: '2026-06-11' },
    });
  });

  it('broadcasts prediction config events without redis in local development', async () => {
    const service = new SyncService(
      new BodyLabConfigService({
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
        oidcClientId: 'body-lab-mac',
        oidcRedirectUri: 'bodylab-mac://auth/callback',
        sessionCookieName: 'body_lab_session',
        sessionMaxAgeSeconds: 3600,
      }),
    );

    const event = firstValueFrom(service.streamPredictionConfig('account-1').pipe(skip(1), take(1)));
    await service.publishPredictionConfig('account-1', [{ id: 'meal-1', key: 'balanced' }]);

    await expect(event).resolves.toMatchObject({
      type: 'prediction-config',
      data: { resource: 'prediction-config', action: 'updated', items: [{ id: 'meal-1', key: 'balanced' }] },
    });
  });
});
