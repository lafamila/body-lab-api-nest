import { Controller, Get } from '@nestjs/common';
import { BodyLabConfigService } from '../config/config.service';

@Controller('health')
export class HealthController {
  constructor(private readonly config: BodyLabConfigService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'body-lab',
      environment: this.config.nodeEnv,
      publicBaseUrl: this.config.publicBaseUrl,
      productionBaseUrl: this.config.productionBaseUrl,
      redisConfigured: Boolean(this.config.redisUrl),
    };
  }
}
