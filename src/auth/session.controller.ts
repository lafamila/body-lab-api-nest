import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthAccountParam } from './auth-account.decorator';
import { AuthAccount } from './auth.types';
import { BodyLabSessionGuard, setSessionCookie } from './body-lab-session.guard';
import { BodyLabSessionService } from './body-lab-session.service';
import { OidcCompleteLoginDto, OidcStartLoginDto } from './session.dto';
import { BodyLabConfigService } from '../config/config.service';

@Controller('session')
export class SessionController {
  constructor(
    private readonly sessions: BodyLabSessionService,
    private readonly config: BodyLabConfigService,
  ) {}

  @Post('oidc/start')
  startOidcLogin(@Body() body: OidcStartLoginDto) {
    return this.sessions.startOidcLogin(body);
  }

  @Get('oidc/callback')
  async oidcCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.sessions.completeOidcCallback({
      code,
      state,
      error,
      errorDescription,
    });
    if (result.session) {
      setSessionCookie(response, this.config.sessionCookieName, result.session.sessionId, this.config.sessionMaxAgeSeconds);
    }
    if (result.redirectUri) {
      response.redirect(result.redirectUri);
      return;
    }
    if (result.session) {
      response.redirect('/admin');
      return;
    }
    response
      .type('html')
      .send(callbackHtml(result.loginTransactionId, result.errorCode, result.error));
  }

  @Post('oidc/complete')
  completeOidcLogin(@Body() body: OidcCompleteLoginDto, @Res({ passthrough: true }) response: Response) {
    const session = this.sessions.completeOidcLogin(body.loginTransactionId);
    setSessionCookie(response, this.config.sessionCookieName, session.sessionId, this.config.sessionMaxAgeSeconds);
    return session;
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('me')
  me(@AuthAccountParam() account: AuthAccount) {
    return account;
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const guard = new BodyLabSessionGuard(this.sessions, this.config);
    await this.sessions.logout(guard.extractSessionId(request));
    response.clearCookie(this.config.sessionCookieName, { path: '/' });
    return { ok: true };
  }
}

function callbackHtml(
  loginTransactionId: string | undefined,
  errorCode: string | undefined,
  error: string | undefined,
): string {
  const safeTransactionId = escapeHtml(loginTransactionId ?? '');
  const safeErrorCode = escapeHtml(errorCode ?? '');
  const safeError = escapeHtml(error ?? '');
  const title = error ? 'body-lab login failed' : 'body-lab login complete';
  const body = error
    ? `<p>Login failed.</p><p class="error">${safeError}</p>${safeErrorCode ? `<p class="muted">Code: ${safeErrorCode}</p>` : ''}`
    : `<p>Login complete. Return to the body-lab app.</p><p class="muted">Transaction: ${safeTransactionId}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #17202a; }
    .error { color: #b42318; }
    .muted { color: #667085; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
