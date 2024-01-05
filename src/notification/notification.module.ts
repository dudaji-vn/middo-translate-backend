import {
  Notification,
  NotificationSchema,
} from './schemas/notifications.schema';

import { FirebaseModule } from 'nestjs-firebase';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { envConfig } from 'src/configs/env.config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),

    FirebaseModule.forRoot({
      googleApplicationCredential: {
        clientEmail: envConfig.firebase.credentials.clientEmail,
        privateKey: envConfig.firebase.credentials.privateKey.replace(
          /\\n/g,
          '\n',
        ),
        projectId: envConfig.firebase.credentials.projectId,
      },
    }),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
