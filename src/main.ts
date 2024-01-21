import * as compression from 'compression';
import * as firebase from 'firebase-admin';
import * as passport from 'passport';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { envConfig } from './configs/env.config';
import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';
import { consoleFormat } from 'winston-console-format';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      level: 'silly',
      format: format.combine(
        format.timestamp(),
        format.ms(),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
      ),
      defaultMeta: { service: 'Test' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize({ all: true }),
            format.padLevels(),
            consoleFormat({
              showMeta: true,
              metaStrip: ['timestamp', 'service'],
              inspectOptions: {
                depth: Infinity,
                colors: true,
                maxArrayLength: Infinity,
                breakLength: 120,
                compact: Infinity,
              },
            }),
          ),
        }),
      ],
    }),
  });
  app.setGlobalPrefix('api', { exclude: ['/'] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.use(
    compression({
      threshold: 100 * 1000,
    }),
  );
  app.enableCors({
    origin: '*',
  });
  app.use(passport.initialize());
  firebase.initializeApp({
    credential: firebase.credential.cert({
      clientEmail: envConfig.firebase.credentials.clientEmail,
      privateKey: envConfig.firebase.credentials.privateKey.replace(
        /\\n/g,
        '\n',
      ),
      projectId: envConfig.firebase.credentials.projectId,
    }),
  });

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('Auth')
    .addTag('Users')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(envConfig.port);
  const logger = new Logger('main');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
