import * as compression from 'compression';
import * as passport from 'passport';

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
  await app.listen(envConfig.port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
