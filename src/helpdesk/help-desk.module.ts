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
import {
  HelpDeskClient,
  HelpDeskClientSchema,
} from './schemas/help-desk-client.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDeskClient.name, schema: HelpDeskClientSchema },
      { name: HelpDeskBusiness.name, schema: HelpDeskBusinessSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
    forwardRef(() => RoomsModule),
  ],
  providers: [HelpDeskService],
  controllers: [HelpDeskController],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}
