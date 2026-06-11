import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey } from 'jose';
import { BodyLabConfigService } from '../config/config.service';
import { AuthAccount } from './auth.types';

type ServicePermissionCandidate = string | string[] | Record<string, unknown>;

@Injectable()
export class AuthService {
  private jwks?: JWTVerifyGetKey;
  private discoveredJwksUrl?: string;

  constructor(private readonly config: BodyLabConfigService) {}

  async verifyBearerToken(token: string): Promise<AuthAccount> {
    const jwks = await this.getJwks();
    const result = await jwtVerify(token, jwks, {
      issuer: this.config.authIssuerUrl,
      audience: this.config.authAudience,
    });
    return this.validatePayload(result.payload);
  }

  validatePayload(payload: JWTPayload): AuthAccount {
    const subject = typeof payload.sub === 'string' ? payload.sub : undefined;
    const accountId = this.extractAccountId(payload);
    if (!subject || !accountId) {
      throw new UnauthorizedException('Token is missing account subject');
    }

    const permission = this.extractPermission(payload);
    if (permission !== this.config.authRequiredPermission) {
      throw new UnauthorizedException('body-lab owner permission is required');
    }

    return {
      accountId,
      subject,
      serviceKey: this.config.authServiceKey,
      permission,
      claims: payload as Record<string, unknown>,
    };
  }

  private extractAccountId(payload: JWTPayload): string | undefined {
    const claims = payload as Record<string, unknown>;
    for (const key of ['accountId', 'account_id', 'account']) {
      const value = claims[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  }

  private extractPermission(payload: JWTPayload): string | undefined {
    const claims = payload as Record<string, unknown>;
    const serviceKey = this.config.authServiceKey;

    const directServiceClaim = claims[serviceKey] as ServicePermissionCandidate | undefined;
    const directPermission = this.permissionFromCandidate(directServiceClaim);
    if (directPermission) {
      return directPermission;
    }

    const services = claims.services;
    if (services && typeof services === 'object' && !Array.isArray(services)) {
      const candidate = (services as Record<string, ServicePermissionCandidate>)[serviceKey];
      const permission = this.permissionFromCandidate(candidate);
      if (permission) {
        return permission;
      }
    }

    const servicePermissions = claims.servicePermissions ?? claims.service_permissions ?? claims.permissions;
    if (Array.isArray(servicePermissions)) {
      return this.permissionFromArray(servicePermissions, serviceKey);
    }

    return undefined;
  }

  private permissionFromCandidate(candidate: ServicePermissionCandidate | undefined): string | undefined {
    if (typeof candidate === 'string') {
      return candidate;
    }
    if (Array.isArray(candidate)) {
      return candidate.find((entry) => typeof entry === 'string');
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      for (const key of ['permission', 'role', 'access']) {
        const value = record[key];
        if (typeof value === 'string') {
          return value;
        }
      }
      const permissions = record.permissions;
      if (Array.isArray(permissions)) {
        return permissions.find((entry): entry is string => typeof entry === 'string');
      }
    }
    return undefined;
  }

  private permissionFromArray(entries: unknown[], serviceKey: string): string | undefined {
    for (const entry of entries) {
      if (typeof entry === 'string') {
        const [candidateService, permission] = entry.split(':');
        if (candidateService === serviceKey && permission) {
          return permission;
        }
        continue;
      }
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const candidateService = record.serviceKey ?? record.service_key ?? record.service ?? record.key;
      if (candidateService !== serviceKey) {
        continue;
      }
      const permission = record.permission ?? record.role ?? record.access;
      if (typeof permission === 'string') {
        return permission;
      }
    }
    return undefined;
  }

  private async getJwks(): Promise<JWTVerifyGetKey> {
    if (this.jwks) {
      return this.jwks;
    }

    const jwksUrl = this.config.authJwksUrl ?? (await this.discoverJwksUrl());
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    return this.jwks;
  }

  private async discoverJwksUrl(): Promise<string> {
    if (this.discoveredJwksUrl) {
      return this.discoveredJwksUrl;
    }

    const issuer = this.config.authIssuerUrl.replace(/\/$/, '');
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new UnauthorizedException('Unable to load auth discovery metadata');
    }
    const metadata = (await response.json()) as Record<string, unknown>;
    if (typeof metadata.jwks_uri !== 'string') {
      throw new UnauthorizedException('Auth discovery metadata is missing jwks_uri');
    }
    this.discoveredJwksUrl = metadata.jwks_uri;
    return this.discoveredJwksUrl;
  }
}
