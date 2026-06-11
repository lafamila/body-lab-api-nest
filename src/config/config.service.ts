import { AppConfig } from './app-config';

export class BodyLabConfigService {
  constructor(private readonly config: AppConfig) {}

  get nodeEnv(): string {
    return this.config.nodeEnv;
  }

  get host(): string {
    return this.config.host;
  }

  get port(): number {
    return this.config.port;
  }

  get publicBaseUrl(): string {
    return this.config.publicBaseUrl;
  }

  get lanBaseUrl(): string | undefined {
    return this.config.lanBaseUrl;
  }

  get productionBaseUrl(): string {
    return this.config.productionBaseUrl;
  }

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get databaseSsl(): boolean {
    return this.config.databaseSsl;
  }

  get redisUrl(): string | undefined {
    return this.config.redisUrl;
  }

  get redisKeyPrefix(): string {
    return this.config.redisKeyPrefix;
  }

  get authIssuerUrl(): string {
    return this.config.authIssuerUrl;
  }

  get authJwksUrl(): string | undefined {
    return this.config.authJwksUrl;
  }

  get authAudience(): string {
    return this.config.authAudience;
  }

  get authServiceKey(): string {
    return this.config.authServiceKey;
  }

  get authRequiredPermission(): string {
    return this.config.authRequiredPermission;
  }
}
