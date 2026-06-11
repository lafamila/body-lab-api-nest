import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BodyLabSessionGuard } from './body-lab-session.guard';
import { BodyLabSessionService } from './body-lab-session.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionController } from './session.controller';

@Module({
  controllers: [SessionController],
  providers: [AuthService, JwtAuthGuard, BodyLabSessionGuard, BodyLabSessionService],
  exports: [AuthService, JwtAuthGuard, BodyLabSessionGuard, BodyLabSessionService],
})
export class AuthModule {}
