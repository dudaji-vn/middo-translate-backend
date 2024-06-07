import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppNotificationsModule } from 'src/app-notifications/app-notifications.module';
import { MailModule } from 'src/mail/mail.module';
import { UsersModule } from 'src/users/users.module';
import { Station, StationSchema } from './schemas/station.schema';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Station.name, schema: StationSchema }]),
    UsersModule,
    MailModule,
    AppNotificationsModule,
  ],

  controllers: [StationsController],
  providers: [StationsService],
  exports: [StationsService],
})
export class StationModule {}
