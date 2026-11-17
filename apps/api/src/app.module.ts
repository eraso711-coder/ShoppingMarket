import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.message}`);
        return parsed.data;
      },
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
