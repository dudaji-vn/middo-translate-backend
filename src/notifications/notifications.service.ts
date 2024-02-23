import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notifications.schema';
import { messaging } from 'firebase-admin';
import { RoomNotification } from './schemas/room-notifications.schema';
import { envConfig } from 'src/configs/env.config';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(RoomNotification.name)
    private roomNotificationModel: Model<RoomNotification>,
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}
  async sendNotification(
    userIds: string[],
    title: string,
    body: string,
    link?: string,
  ) {
    const notifications = await this.notificationModel.find({
      userId: { $in: userIds },
    });
    if (!notifications.length) {
      return;
    }
    let tokens: string[] = notifications.reduce((acc, notification) => {
      acc.push(...notification.tokens);
      return acc;
    }, [] as string[]);

    const expoTokens = tokens.filter((token) =>
      token.includes('ExponentPushToken'),
    );
    console.log(expoTokens);
    tokens = tokens.filter((token) => !token.includes('ExponentPushToken'));
    try {
      const response = await messaging().sendEachForMulticast({
        tokens: tokens || [],
        data: {
          title,
          body,
          url: link || envConfig.app.url,
        },
        webpush: {
          fcmOptions: {
            link: link || envConfig.app.url,
          },
        },
      });
      response.responses.forEach(async (res, index) => {
        if (
          res.error?.code === 'messaging/invalid-registration-token' ||
          res.error?.code === 'messaging/registration-token-not-registered'
        ) {
          const token = tokens[index];
          await this.notificationModel.updateOne(
            { tokens: { $in: [token] } },
            { $pull: { tokens: token } },
          );
        }
      });
      if (expoTokens.length) {
        const expo = new Expo();
        const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
          to: token,
          sound: 'default',
          title,
          body,
          data: { url: link || envConfig.app.url },
        }));
        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log(ticketChunk);
          } catch (error) {
            console.error(error);
          }
        }
      }
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
    await notification.updateOne({ $addToSet: { tokens: token } });
  }

  async getDevices(userId: string) {
    const notification = await this.notificationModel.findOne({ userId });
    if (!notification) {
      return [];
    }
    return notification.tokens;
  }

  async checkSubscription(userId: string, token: string) {
    const notification = await this.notificationModel.findOne({
      userId,
      tokens: { $in: [token] },
    });
    return !!notification;
  }

  async deleteToken(userId: string, token: string) {
    await this.notificationModel.updateOne(
      { userId },
      { $pull: { tokens: token } },
    );
  }

  async deleteAllTokens(userId: string) {
    await this.notificationModel.deleteOne({ userId });
  }

  async toggleNotification(roomId: string, userId: string) {
    console.log(roomId, userId);
    const roomNotification = await this.roomNotificationModel.findOne({
      user: userId,
      room: roomId,
    });

    if (roomNotification) {
      await roomNotification.deleteOne();
    } else {
      await this.roomNotificationModel.create({
        room: roomId,
        user: userId,
      });
    }
  }

  async getUsersIgnoringRoom(roomId: string) {
    const notification = await this.roomNotificationModel.find({
      room: roomId,
    });
    return notification.map((n) => n.user._id.toString()) || [];
  }

  async checkIsUserIgnoringRoom(roomId: string, userId: string) {
    const notification = await this.roomNotificationModel.exists({
      room: roomId,
      user: userId,
    });
    return !!notification;
  }
}
