import { Module } from '@nestjs/common';
import { StationService } from './station.service';
import { StationController } from './station.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Station, StationSchema } from './schemas/station.schema';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Station.name, schema: StationSchema }]),
    UsersModule,
    MailModule,
  ],

  controllers: [StationController],
  providers: [StationService],
  exports: [StationService],
})
export class StationModule {}
