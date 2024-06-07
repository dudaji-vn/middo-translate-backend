import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppNotificationsController } from './app-notifications.controller';
import { AppNotificationsService } from './app-notifications.service';
import {
  AppNotification,
  AppNotificationSchema,
} from './schemas/app-notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppNotification.name, schema: AppNotificationSchema },
    ]),
  ],

  controllers: [AppNotificationsController],
  providers: [AppNotificationsService],
  exports: [AppNotificationsService],
})
export class AppNotificationsModule {}
