import { Global, Module } from '@nestjs/common';
import { loadAppConfig } from './app-config';
import { BodyLabConfigService } from './config.service';

@Global()
@Module({
  providers: [
    {
      provide: BodyLabConfigService,
      useFactory: () => new BodyLabConfigService(loadAppConfig()),
    },
  ],
  exports: [BodyLabConfigService],
})
export class BodyLabConfigModule {}
