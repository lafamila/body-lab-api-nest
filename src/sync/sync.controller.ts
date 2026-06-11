import { Controller, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { ServerSentMessage, SyncService } from './sync.service';

@UseGuards(BodyLabSessionGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Sse('events')
  events(@AuthAccountParam() account: AuthAccount): Observable<ServerSentMessage> {
    return this.syncService.stream(account.accountId);
  }
}
