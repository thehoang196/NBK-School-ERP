import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new TransformInterceptor(),
  );

  // CORS
  const corsOrigins = process.env['CORS_ORIGINS'];
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : '*',
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('NBK_EMS API')
    .setDescription(
      'NBK Education Management System - Hệ thống Quản lý Giáo dục NBK',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  console.log(`🚀 NBK_EMS API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
