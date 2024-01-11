import { CallService } from './call.service';
import { CallController } from './call.controller';
import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Call, CallSchema } from './schemas/call.schema';
import { RoomsModule } from 'src/rooms/rooms.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    UsersModule,
    forwardRef(() => RoomsModule),
  ],
  providers: [CallService],
  controllers: [CallController],
  exports: [CallService],
})
export class CallModule {}
