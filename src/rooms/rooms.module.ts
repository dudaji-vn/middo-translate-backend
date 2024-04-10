import { Module, forwardRef } from '@nestjs/common';
import { Room, RoomSchema } from './schemas/room.schema';

import { MessagesModule } from 'src/messages/messages.module';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { UsersModule } from 'src/users/users.module';
import { HelpDeskModule } from 'src/help-desk/help-desk.module';
import {
  HelpDeskBusiness,
  HelpDeskBusinessSchema,
} from '../help-desk/schemas/help-desk-business.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: HelpDeskBusiness.name, schema: HelpDeskBusinessSchema },
    ]),
    UsersModule,
    NotificationModule,
    HelpDeskModule,
    forwardRef(() => MessagesModule),
  ],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
