import { Message, MessageSchema } from './schemas/messages.schema';
import { Module, forwardRef } from '@nestjs/common';

import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { UsersModule } from 'src/users/users.module';
import { Call, CallSchema } from 'src/call/schemas/call.schema';
import { CallModule } from 'src/call/call.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Call.name, schema: CallSchema },
    ]),
    NotificationModule,
    UsersModule,
    forwardRef(() => RoomsModule),
    forwardRef(() => CallModule),
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
