import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global exception filter for better error handling
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS with flexible origin handling for development
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    'http://localhost:3006',
    'http://localhost:3007',
    'http://localhost:8081', // Expo web
    'http://localhost:19006', // Expo web alternative
    'exp://localhost:8081', // Expo dev client
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ CORS: Allowing request with no origin (mobile app/Postman)');
        }
        return callback(null, true);
      }

      // In development, allow localhost and local IP addresses
      if (process.env.NODE_ENV !== 'production') {
        // Allow localhost with any port
        if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
          console.log(`✅ CORS: Allowing localhost origin: ${origin}`);
          return callback(null, true);
        }
        
        // Allow 10.0.2.2 (Android emulator)
        if (origin.startsWith('http://10.0.2.2:') || origin.startsWith('https://10.0.2.2:')) {
          console.log(`✅ CORS: Allowing Android emulator origin: ${origin}`);
          return callback(null, true);
        }
        
        // Allow local IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        const localIpPattern = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+):\d+/;
        if (localIpPattern.test(origin)) {
          console.log(`✅ CORS: Allowing local IP origin: ${origin}`);
          return callback(null, true);
        }
        
        // Allow Expo dev client
        if (origin.startsWith('exp://') || origin.startsWith('exps://')) {
          console.log(`✅ CORS: Allowing Expo dev client origin: ${origin}`);
          return callback(null, true);
        }
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`✅ CORS: Allowing configured origin: ${origin}`);
        }
        return callback(null, true);
      }

      // Reject other origins
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`❌ CORS: Blocking origin: ${origin}`);
        console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
      }
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Handmade Marketplace API')
      .setDescription('API for Handmade Marketplace Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3005;
  
  // Global error handler for unhandled exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
  logger.log(`🔍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();

