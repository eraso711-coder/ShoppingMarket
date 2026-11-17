import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api'));
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const swagger = new DocumentBuilder()
    .setTitle('ShoppingMarket API')
    .setDescription('Family shopping lists and supermarket price comparison API.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`ShoppingMarket API listening on http://localhost:${port}/api`);
}
void bootstrap();
