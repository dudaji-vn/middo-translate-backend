import {
  Notification,
  NotificationSchema,
} from './schemas/notifications.schema';
import {
  RoomNotification,
  RoomNotificationSchema,
} from './schemas/room-notifications.schema';

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notifications.controller';
import { NotificationService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      {
        name: RoomNotification.name,
        schema: RoomNotificationSchema,
      },
    ]),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
