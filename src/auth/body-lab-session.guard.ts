import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { BodyLabConfigService } from '../config/config.service';
import { RequestWithAuth } from './auth.types';
import { BodyLabSessionService } from './body-lab-session.service';

@Injectable()
export class BodyLabSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: BodyLabSessionService,
    private readonly config: BodyLabConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & Partial<RequestWithAuth>>();
    const sessionId = this.extractSessionId(request);
    if (!sessionId) {
      throw new UnauthorizedException('Body-lab session is required');
    }
    const session = await this.sessions.requireSession(sessionId);
    request.authAccount = session.account;
    return true;
  }

  extractSessionId(request: Request): string | undefined {
    const header = request.headers['x-body-lab-session'];
    if (typeof header === 'string' && header.trim()) {
      return header.trim();
    }
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }
    const cookie = cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${this.config.sessionCookieName}=`));
    return cookie ? decodeURIComponent(cookie.split('=', 2)[1] ?? '') : undefined;
  }
}

export function setSessionCookie(response: Response, name: string, value: string, maxAgeSeconds: number): void {
  response.cookie(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  });
}
