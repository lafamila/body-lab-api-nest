import { firstValueFrom } from 'rxjs';
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
        authRequiredPermission: 'owner',
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
});
