import { Message, MessageSchema } from './schemas/messages.schema';
import { Module, forwardRef } from '@nestjs/common';

import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    NotificationModule,
    UsersModule,
    forwardRef(() => RoomsModule),
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
