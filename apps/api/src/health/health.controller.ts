import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get()
  @ApiOperation({ summary: 'Check API and database health' })
  @ApiResponse({ status: 200, description: 'API and database are available.' })
  @ApiResponse({ status: 503, description: 'Database is unavailable.' })
  check() { return this.health.check(); }
}
