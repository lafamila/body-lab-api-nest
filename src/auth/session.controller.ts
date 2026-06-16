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
      const retryUri = result.errorCode
        ? this.buildRetryThroughAuthLogoutUri(result.loginTransactionId)
        : undefined;
      const accessRequestUri = result.accessRequestAvailable
        ? this.buildAccessRequestUri(result.loginTransactionId)
        : undefined;
      response
        .type('html')
        .send(
          callbackHtml({
            loginTransactionId: result.loginTransactionId,
            errorCode: result.errorCode,
            error: result.error,
            appOpenUri: result.redirectUri,
            retryUri,
            accessRequestUri,
            accessRequested: result.accessRequested,
          }),
        );
      return;
    }
    if (result.session) {
      response.redirect('/admin');
      return;
    }
    response
      .type('html')
      .send(callbackHtml({
        loginTransactionId: result.loginTransactionId,
        errorCode: result.errorCode,
        error: result.error,
      }));
  }

  @Get('oidc/request-access')
  async requestAccess(
    @Query('loginTransactionId') loginTransactionId: string | undefined,
    @Res() response: Response,
  ) {
    if (!loginTransactionId) {
      response
        .type('html')
        .send(callbackHtml({ errorCode: 'invalid_request', error: 'Missing login transaction id' }));
      return;
    }
    const result = await this.sessions.requestTesterAccess(loginTransactionId);
    response
      .type('html')
      .send(callbackHtml({
        loginTransactionId: result.loginTransactionId,
        errorCode: result.errorCode,
        error: result.error,
        appOpenUri: result.redirectUri,
        retryUri: this.buildRetryThroughAuthLogoutUri(result.loginTransactionId),
        accessRequested: true,
      }));
  }

  @Get('oidc/retry')
  retryOidcLogin(
    @Query('loginTransactionId') loginTransactionId: string | undefined,
    @Res() response: Response,
  ) {
    if (!loginTransactionId) {
      response
        .type('html')
        .send(callbackHtml({ errorCode: 'invalid_request', error: 'Missing login transaction id' }));
      return;
    }
    const retry = this.sessions.retryOidcLogin(loginTransactionId);
    response.clearCookie(this.config.sessionCookieName, { path: '/' });
    response.redirect(retry.authorizeUrl);
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

  private buildRetryThroughAuthLogoutUri(loginTransactionId: string | undefined): string | undefined {
    if (!loginTransactionId) {
      return undefined;
    }
    const retryUri = new URL('/session/oidc/retry', this.config.publicBaseUrl);
    retryUri.searchParams.set('loginTransactionId', loginTransactionId);
    const logoutUri = new URL('/logout', this.config.authApiBaseUrl);
    logoutUri.searchParams.set('return_to', retryUri.toString());
    return logoutUri.toString();
  }

  private buildAccessRequestUri(loginTransactionId: string | undefined): string | undefined {
    if (!loginTransactionId) {
      return undefined;
    }
    const requestUri = new URL('/session/oidc/request-access', this.config.publicBaseUrl);
    requestUri.searchParams.set('loginTransactionId', loginTransactionId);
    return requestUri.toString();
  }
}

function callbackHtml(input: {
  loginTransactionId?: string;
  errorCode?: string;
  error?: string;
  appOpenUri?: string;
  retryUri?: string;
  accessRequestUri?: string;
  accessRequested?: boolean;
}): string {
  const {
    loginTransactionId,
    errorCode,
    error,
    appOpenUri,
    retryUri,
    accessRequestUri,
    accessRequested,
  } = input;
  const safeTransactionId = escapeHtml(loginTransactionId ?? '');
  const safeErrorCode = escapeHtml(errorCode ?? '');
  const safeError = escapeHtml(error ?? '');
  const safeAppOpenUri = escapeHtml(appOpenUri ?? '');
  const safeRetryUri = escapeHtml(retryUri ?? '');
  const safeAccessRequestUri = escapeHtml(accessRequestUri ?? '');
  const appOpenUriJson = JSON.stringify(appOpenUri ?? '');
  const title = error ? 'body-lab login failed' : 'body-lab login complete';
  const message = error
    ? `<p>Login failed.</p><p class="error">${safeError}</p>${safeErrorCode ? `<p class="muted">Code: ${safeErrorCode}</p>` : ''}${accessRequested ? '<p class="notice">권한 요청을 보냈습니다.</p>' : ''}`
    : `<p>Login complete.</p><p class="muted">Transaction: ${safeTransactionId}</p>`;
  const openApp = appOpenUri
    ? `<a class="button" id="open-app" href="${safeAppOpenUri}">Open body-lab app</a>
       <p class="muted">If the app did not open automatically, use the button above.</p>`
    : '';
  const retryLogin = retryUri
    ? `<a class="button" id="retry-login" href="${safeRetryUri}">다시 로그인하기</a>
       <p class="muted">This clears the current auth login session before restarting.</p>`
    : '';
  const requestAccess = accessRequestUri
    ? `<a class="button" id="request-access" href="${safeAccessRequestUri}">권한 요청하기</a>
       <p class="muted">Request tester access for body-lab.</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      color: #17202a;
      background: #f6f7f9;
    }
    main {
      width: min(360px, calc(100vw - 32px));
      display: grid;
      gap: 12px;
    }
    h1 { margin: 0; font-size: 20px; }
    p { margin: 0; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 6px;
      background: #17202a;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }
    .error { color: #b42318; }
    .notice { color: #1769aa; font-weight: 600; }
    .muted { color: #667085; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${message}
    ${error ? requestAccess || retryLogin : openApp}
  </main>
  ${
    appOpenUri && !error
      ? `<script>
    window.setTimeout(() => {
      window.location.href = ${appOpenUriJson};
    }, 250);
  </script>`
      : ''
  }
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
