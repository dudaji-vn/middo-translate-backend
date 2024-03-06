import { Module, forwardRef } from '@nestjs/common';
import { HelpDesk, HelpDeskSchema } from './schemas/help-desk.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { UsersModule } from 'src/users/users.module';
import { HelpDeskController } from './help-desk.controller';
import { HelpDeskService } from './help-desk.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDesk.name, schema: HelpDeskSchema },
    ]),
    NotificationModule,
    UsersModule,
    forwardRef(() => RoomsModule),
  ],
  providers: [HelpDeskService],
  controllers: [HelpDeskController],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}
