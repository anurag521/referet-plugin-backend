import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
dotenv.config();

import { Type } from '@nestjs/common';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS FIRST before any other middleware
  app.enableCors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'ngrok-skip-browser-warning',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ],
    exposedHeaders: ['*'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Body parser middleware
  app.use(
    bodyParser.json({
      verify: (req: any, res: any, buf: any) => {
        (req as any).rawBody = buf;
      },
    }),
  );

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();


