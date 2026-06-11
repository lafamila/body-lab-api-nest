import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthAccountParam } from './auth-account.decorator';
import { AuthAccount } from './auth.types';
import { BodyLabSessionGuard, setSessionCookie } from './body-lab-session.guard';
import { BodyLabSessionService } from './body-lab-session.service';
import { SessionLoginDto } from './session.dto';
import { BodyLabConfigService } from '../config/config.service';

@Controller('session')
export class SessionController {
  constructor(
    private readonly sessions: BodyLabSessionService,
    private readonly config: BodyLabConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: SessionLoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.sessions.login(body);
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
