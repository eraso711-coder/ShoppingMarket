import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'shoppingmarket-api', database: 'ok', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error', service: 'shoppingmarket-api', database: 'unavailable', timestamp: new Date().toISOString(),
      });
    }
  }
}
