import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { messaging } from 'firebase-admin';
import { Model } from 'mongoose';
import { logger } from 'src/common/utils/logger';
import { envConfig } from 'src/configs/env.config';
import { WatchingService } from 'src/watching/watching.service';
import { Notification } from './schemas/notifications.schema';
import { RoomNotification } from './schemas/room-notifications.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(RoomNotification.name)
    private roomNotificationModel: Model<RoomNotification>,
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    private watchingService: WatchingService,
  ) {}
  async sendNotification({
    body,
    roomId,
    title,
    userIds,
    link,
    messageId,
  }: {
    userIds: string[];
    title: string;
    body: string;
    roomId: string;
    link?: string;
    messageId?: string;
    message?: any;
  }) {
    const notifications = await this.notificationModel.find({
      userId: { $in: userIds },
    });
    if (!notifications.length) {
      return;
    }
    let tokens: string[] = notifications
      .reduce((acc, notification) => {
        acc.push(...notification.tokens);
        return acc;
      }, [] as string[])
      .filter((token) => !!token);

    const watchingList = await this.watchingService.getWatchingListByRoomId(
      roomId,
    );

    // not push notification to user who is watching the room
    watchingList.forEach((watching) => {
      tokens = tokens.filter((token) => token !== watching.notifyToken);
    });
    try {
      if (tokens.length) {
        const response = await messaging().sendEachForMulticast({
          tokens: tokens || [],
          data: {
            title,
            body,
            url: link || envConfig.app.url,
            messageId: messageId || '',
            roomId,
          },
          webpush: {
            fcmOptions: {
              link: link || envConfig.app.url,
            },
          },
          android: {
            data: {
              title,
              body,
              url: link || envConfig.app.url,
              messageId: messageId || '',
              roomId,
            },
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title,
                  body,
                },
                sound: 'default',
                category: 'MESSAGE',
                url: link || envConfig.app.url,
              },
            },
          },
        });
        response.responses.map(async (res, index) => {
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
      }
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 106: ${error['message']}`,
        '',
        NotificationService.name,
      );
    }
  }

  async storageToken(userId: string, token: string) {
    if (!token || !token?.trim().length) {
      logger.error(
        'StorageToken: Token cannot be empty',
        '',
        NotificationService.name,
      );
      return;
    }
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
    await this.notificationModel.deleteMany({ userId });
  }

  async toggleNotification(roomId: string, userId: string) {
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
