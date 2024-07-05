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
import { WatchingModule } from 'src/watching/watching.module';
import { Room, RoomSchema } from 'src/rooms/schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      {
        name: RoomNotification.name,
        schema: RoomNotificationSchema,
      },
      {
        name: Room.name,
        schema: RoomSchema,
      },
    ]),
    WatchingModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
