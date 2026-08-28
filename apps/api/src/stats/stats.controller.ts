import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller()
export class StatsController {
  constructor(private stats: StatsService) {}

  // Public — no guard. Backs the homepage stats bar.
  @Get('stats')
  getPublicStats() {
    return this.stats.getPublicStats();
  }
}
