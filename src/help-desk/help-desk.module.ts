import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from 'src/rooms/rooms.module';
import { UsersModule } from 'src/users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { HelpDeskController } from './help-desk.controller';
import { HelpDeskService } from './help-desk.service';
import {
  HelpDeskBusiness,
  HelpDeskBusinessSchema,
} from './schemas/help-desk-business.schema';

import { MessagesModule } from '../messages/messages.module';
import { MailModule } from '../mail/mail.module';
import { Space, SpaceSchema } from './schemas/space.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDeskBusiness.name, schema: HelpDeskBusinessSchema },
      { name: User.name, schema: UserSchema },
      { name: Space.name, schema: SpaceSchema },
    ]),
    UsersModule,
    MailModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => RoomsModule),
  ],
  providers: [HelpDeskService],
  controllers: [HelpDeskController],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}
