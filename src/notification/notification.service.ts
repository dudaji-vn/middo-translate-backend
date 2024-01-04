import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as firebase from 'firebase-admin';
import { Notification } from './schemas/notifications.schema';
import { envConfig } from 'src/configs/env.config';

firebase.initializeApp({
  credential: firebase.credential.cert({
    clientEmail: envConfig.firebase.credentials.clientEmail,
    privateKey: envConfig.firebase.credentials.privateKey.replace(/\\n/g, '\n'),
    projectId: envConfig.firebase.credentials.projectId,
  }),
});
@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}
  async sendNotification(userIds: string[], title: string, body: string) {
    const notifications = await this.notificationModel.find({
      userId: { $in: userIds },
    });
    if (!notifications.length) {
      return;
    }
    const tokens: string[] = notifications.reduce((acc, notification) => {
      acc.push(...notification.tokens);
      return acc;
    }, [] as string[]);

    console.log(tokens);

    try {
      const response = await firebase.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
      });
      console.log(response);
    } catch (error) {
      console.log(error);
    }
  }

  async storageToken(userId: string, token: string) {
    const notification = await this.notificationModel.findOne({ userId });
    if (!notification) {
      const newNotification = new this.notificationModel({
        userId,
        tokens: [token],
      });
      await newNotification.save();
      return;
    }
    notification.tokens.push(token);
    await notification.save();
  }
}
