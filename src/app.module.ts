import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsGateway } from './events/events.gateway';
import { EventsModule } from './events/events.module';
import { MailModule } from './mail/mail.module';
import { MailService } from './mail/mail.service';
import { MessagesModule } from './messages/messages.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { RoomsModule } from './rooms/rooms.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { envConfig } from './configs/env.config';
import { StorageModule } from './storage/storage.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(envConfig.database.uri),
    PassportModule.register({ session: true }),
    EventEmitterModule.forRoot(),
    UsersModule,
    MessagesModule,
    RoomsModule,
    AuthModule,
    SearchModule,
    EventsModule,
    MailModule,
    StorageModule,
    RecommendationModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EventsGateway,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    MailService,
  ],
})
export class AppModule {}
