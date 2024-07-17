import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from 'src/mail/mail.module';
import { MessagesModule } from 'src/messages/messages.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { UsersModule } from 'src/users/users.module';
import { HelpDeskController } from './help-desk.controller';
import { HelpDeskService } from './help-desk.service';
import {
  HelpDeskBusiness,
  HelpDeskBusinessSchema,
} from './schemas/help-desk-business.schema';
import {
  SpaceNotification,
  SpaceNotificationSchema,
} from './schemas/space-notifications.schema';
import {
  Script,
  ScriptSchema,
  Space,
  SpaceSchema,
} from './schemas/space.schema';

import {
  HelpDeskForm,
  HelpDeskFormSchema,
} from './schemas/help-desk-form.schema';
import { Visitor, VisitorSchema } from './schemas/visitor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDeskBusiness.name, schema: HelpDeskBusinessSchema },
      {
        name: HelpDeskForm.name,
        schema: HelpDeskFormSchema,
      },
      { name: User.name, schema: UserSchema },
      { name: Space.name, schema: SpaceSchema },
      { name: SpaceNotification.name, schema: SpaceNotificationSchema },
      { name: Script.name, schema: ScriptSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
    NotificationModule,
    MailModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => RoomsModule),
  ],
  providers: [HelpDeskService],
  controllers: [HelpDeskController],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}
