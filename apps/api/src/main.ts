import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { AppLoggerService } from './common/logger/logger.service.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS configuration
  app.enableCors({
    origin: env.WEB_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Global routing prefix (excluding root and docs)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready', 'docs', 'api/docs'],
  });

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DokanDesk API')
    .setDescription(
      'Multi-tenant SME Shop Management Platform API (POS, Inventory, Dues, Accounts)',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'System health and readiness checks')
    .addTag('Tenants', 'Multi-tenant management and branch administration')
    .addTag('Auth', 'Authentication and token lifecycle')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'DokanDesk API Documentation',
  });

  const port = env.PORT || 3000;
  await app.listen(port);
  logger.log(`DokanDesk API running on port ${port}`, 'Bootstrap');
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
