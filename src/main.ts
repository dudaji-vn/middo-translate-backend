import * as compression from 'compression';
import * as firebase from 'firebase-admin';
import * as passport from 'passport';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { envConfig } from './configs/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
