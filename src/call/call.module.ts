import { CallService } from './call.service';
import { CallController } from './call.controller';
import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from 'src/rooms/schemas/room.schema';
import { CallGateway } from './call.gateway';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }]),
        UsersModule,
        ConfigModule.forRoot({ isGlobal: true }),
    ],
    providers: [CallService, CallGateway],
    controllers: [CallController],
    exports: [CallService],
})
export class CallModule {}
