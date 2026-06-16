import { Response } from 'express';
import { SessionController } from '../src/auth/session.controller';
import { BodyLabSessionService } from '../src/auth/body-lab-session.service';
import { BodyLabConfigService } from '../src/config/config.service';

describe('SessionController', () => {
  it('renders an app-open page instead of redirecting immediately after OIDC callback', async () => {
    const sessions = {
      completeOidcCallback: jest.fn().mockResolvedValue({
        loginTransactionId: 'transaction-1',
        redirectUri: 'bodylab-mac://auth/callback?loginTransactionId=transaction-1&status=success',
        session: {
          sessionId: 'session-1',
          user: { id: 'account-1' },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
    } as unknown as BodyLabSessionService;
    const config = {
      sessionCookieName: 'body_lab_session',
      sessionMaxAgeSeconds: 3600,
    } as BodyLabConfigService;
    const controller = new SessionController(sessions, config);
    const response = mockResponse();

    await controller.oidcCallback('code-1', 'state-1', undefined, undefined, response);

    expect(response.redirect).not.toHaveBeenCalled();
    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('Open body-lab app'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('bodylab-mac://auth/callback'));
    expect(response.cookie).toHaveBeenCalledWith(
      'body_lab_session',
      'session-1',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('renders access request for visitor permission failures instead of opening the app', async () => {
    const sessions = {
      completeOidcCallback: jest.fn().mockResolvedValue({
        loginTransactionId: 'transaction-1',
        redirectUri: 'bodylab-mac://auth/callback?loginTransactionId=transaction-1&status=error&errorCode=access_denied',
        errorCode: 'access_denied',
        error: 'body-lab non-visitor permission is required',
        accessRequestAvailable: true,
        accessRequested: false,
      }),
    } as unknown as BodyLabSessionService;
    const config = {
      sessionCookieName: 'body_lab_session',
      sessionMaxAgeSeconds: 3600,
      publicBaseUrl: 'http://localhost:3020',
      authApiBaseUrl: 'http://localhost:3032',
    } as BodyLabConfigService;
    const controller = new SessionController(sessions, config);
    const response = mockResponse();

    await controller.oidcCallback(undefined, 'state-1', 'access_denied', 'body-lab non-visitor permission is required', response);

    expect(response.redirect).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('body-lab login failed'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('body-lab non-visitor permission is required'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('권한 요청하기'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3020/session/oidc/request-access'));
    expect(response.send).not.toHaveBeenCalledWith(expect.stringContaining('Open body-lab app'));
    expect(response.send).not.toHaveBeenCalledWith(expect.stringContaining('다시 로그인하기'));
  });

  it('renders retry login after access has already been requested', async () => {
    const sessions = {
      completeOidcCallback: jest.fn().mockResolvedValue({
        loginTransactionId: 'transaction-1',
        redirectUri: 'bodylab-mac://auth/callback?loginTransactionId=transaction-1&status=error&errorCode=access_denied',
        errorCode: 'access_denied',
        error: 'body-lab non-visitor permission is required',
        accessRequestAvailable: false,
        accessRequested: true,
      }),
    } as unknown as BodyLabSessionService;
    const config = {
      sessionCookieName: 'body_lab_session',
      sessionMaxAgeSeconds: 3600,
      publicBaseUrl: 'http://localhost:3020',
      authApiBaseUrl: 'http://localhost:3032',
    } as BodyLabConfigService;
    const controller = new SessionController(sessions, config);
    const response = mockResponse();

    await controller.oidcCallback(undefined, 'state-1', 'access_denied', 'body-lab non-visitor permission is required', response);

    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('권한 요청을 보냈습니다.'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('다시 로그인하기'));
    expect(response.send).not.toHaveBeenCalledWith(expect.stringContaining('권한 요청하기'));
  });

  it('sends access request and then renders retry login', async () => {
    const sessions = {
      requestTesterAccess: jest.fn().mockResolvedValue({
        loginTransactionId: 'transaction-1',
        redirectUri: 'bodylab-mac://auth/callback?loginTransactionId=transaction-1&status=error&errorCode=access_denied',
        errorCode: 'access_denied',
        error: 'body-lab non-visitor permission is required',
        accessRequestAvailable: false,
        accessRequested: true,
      }),
    } as unknown as BodyLabSessionService;
    const config = {
      sessionCookieName: 'body_lab_session',
      sessionMaxAgeSeconds: 3600,
      publicBaseUrl: 'http://localhost:3020',
      authApiBaseUrl: 'http://localhost:3032',
    } as BodyLabConfigService;
    const controller = new SessionController(sessions, config);
    const response = mockResponse();

    await controller.requestAccess('transaction-1', response);

    expect(sessions.requestTesterAccess).toHaveBeenCalledWith('transaction-1');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('권한 요청을 보냈습니다.'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('다시 로그인하기'));
  });

  it('redirects retry through a fresh authorize URL', () => {
    const sessions = {
      retryOidcLogin: jest.fn().mockReturnValue({
        authorizeUrl: 'http://localhost:3032/oauth/authorize?state=fresh-state',
        loginTransactionId: 'transaction-2',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    } as unknown as BodyLabSessionService;
    const config = {
      sessionCookieName: 'body_lab_session',
      sessionMaxAgeSeconds: 3600,
    } as BodyLabConfigService;
    const controller = new SessionController(sessions, config);
    const response = mockResponse();

    controller.retryOidcLogin('transaction-1', response);

    expect(sessions.retryOidcLogin).toHaveBeenCalledWith('transaction-1');
    expect(response.clearCookie).toHaveBeenCalledWith('body_lab_session', { path: '/' });
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:3032/oauth/authorize?state=fresh-state');
  });
});

function mockResponse(): Response {
  const response = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return response as unknown as Response;
}
