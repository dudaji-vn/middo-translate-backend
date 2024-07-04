import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { messaging } from 'firebase-admin';
import { Model } from 'mongoose';
import { logger } from 'src/common/utils/logger';
import { envConfig } from 'src/configs/env.config';
import { WatchingService } from 'src/watching/watching.service';
import { Notification } from './schemas/notifications.schema';
import { RoomNotification } from './schemas/room-notifications.schema';
import { SubscriptionType } from './dto/subscribe.dto';
import {
  AndroidConfig,
  ApnsConfig,
} from 'firebase-admin/lib/messaging/messaging-api';
import { Room, RoomStatus } from 'src/rooms/schemas/room.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(RoomNotification.name)
    private roomNotificationModel: Model<RoomNotification>,
    @InjectModel(Room.name)
    private roomModel: Model<Room>,
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    private watchingService: WatchingService,
  ) {}
  async notifyToExtensionMobile({
    extensionTokens,
    data,
    android,
    apns,
  }: {
    extensionTokens: string[];
    data: {
      [key: string]: string;
    };
    android?: AndroidConfig;
    apns?: ApnsConfig;
  }) {
    console.log('EXT-tokens::>', extensionTokens);
    try {
      if (extensionTokens.length) {
        const response = await messaging().sendEachForMulticast({
          tokens: extensionTokens || [],
          data,
          android,
          apns,
        });
        response.responses.map(async (res, index) => {
          if (
            res.error?.code === 'messaging/invalid-registration-token' ||
            res.error?.code === 'messaging/registration-token-not-registered'
          ) {
            const token = extensionTokens[index];
            await this.notificationModel.updateOne(
              { extensionTokens: { $in: [token] } },
              { $pull: { extensionTokens: token } },
            );
          }
        });
      }
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 86: ${error['message']}`,
        '',
        NotificationService.name,
      );
    }
  }
  async sendNotification({
    body,
    roomId,
    title,
    userIds,
    link,
    messageId,
    destinationApp,
  }: {
    userIds: string[];
    title: string;
    body: string;
    roomId: string;
    link?: string;
    messageId?: string;
    message?: any;
    destinationApp?: SubscriptionType;
  }) {
    const forExtensionMobile = destinationApp === 'extension';
    const notifications = await this.notificationModel.find({
      userId: { $in: userIds },
    });
    if (!notifications.length) {
      return;
    }

    let tokens: string[] = notifications.flatMap((notification) =>
      notification.tokens.filter((t) => !!t),
    );
    let extensionTokens: string[] = notifications.flatMap((notification) =>
      notification.extensionTokens.filter((t) => !!t),
    );

    const watchingList = await this.watchingService.getWatchingListByRoomId(
      roomId,
    );
    // not push notification to user who is watching the room
    watchingList.forEach((watching) => {
      tokens = tokens.filter((token) => token !== watching.notifyToken);
      extensionTokens = extensionTokens.filter(
        (token) => token !== watching.notifyToken,
      );
    });
    const url = link || envConfig.app.url;
    const data = {
      title,
      body,
      url,
      messageId: messageId || '',
      roomId,
    };
    const android: AndroidConfig = {
      data,
      priority: 'high',
    };
    const apns: ApnsConfig = {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          url,
          sound: 'default',
          category: 'MESSAGE',
        },
      },
    };
    if (forExtensionMobile && extensionTokens.length) {
      this.notifyToExtensionMobile({
        extensionTokens,
        data,
        android,
        apns,
      });
    }
    try {
      if (tokens.length) {
        logger.info(
          `Sending notification to ${tokens.length} places`,
          '',
          NotificationService.name,
        );
        console.log('notify OTHER-tokens::>', tokens);
        const response = await messaging().sendEachForMulticast({
          tokens: tokens || [],
          data,
          webpush: {
            fcmOptions: {
              link: url,
            },
          },
          ...(forExtensionMobile ? {} : { android, apns }),
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

  async storageToken(userId: string, token: string, type?: SubscriptionType) {
    if (!token || !token?.trim().length) {
      logger.error(
        'StorageToken: Token cannot be empty',
        '',
        NotificationService.name,
      );
      return;
    }
    const isExtension = type === 'extension';
    const storeDestinationKey = isExtension ? 'extensionTokens' : 'tokens';
    const notification = await this.notificationModel.findOne({ userId });
    if (!notification) {
      const newNotification = new this.notificationModel({
        userId,
        [storeDestinationKey]: [token],
      });
      await newNotification.save();
      return;
    }
    await notification.updateOne({
      $addToSet: {
        [storeDestinationKey]: token,
      },
    });
  }

  async getDevices(userId: string) {
    const notification = await this.notificationModel.findOne({ userId });
    if (!notification) {
      return [];
    }
    return notification.tokens;
  }

  async checkSubscription(
    userId: string,
    token: string,
    type?: SubscriptionType,
  ) {
    const isExtension = type === 'extension';
    const storeKey = isExtension ? 'extensionTokens' : 'tokens';
    const notification = await this.notificationModel.findOne({
      userId,
      [storeKey]: { $in: [token] },
    });
    return !!notification;
  }

  async deleteToken(userId: string, token: string, type?: string) {
    const isExtension = type === 'extension';
    const storeKey = isExtension ? 'extensionTokens' : 'tokens';
    await this.notificationModel.updateOne(
      { userId },
      { $pull: { [storeKey]: token } },
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

  async toggleStationNotification(stationId: string, userId: string) {
    try {
      const roomIds = await this.roomModel
        .find({
          station: stationId,
          status: RoomStatus.ACTIVE,
          deleteFor: { $nin: [userId] },
        })
        .distinct('_id');

      if (!roomIds || roomIds.length === 0) {
        return;
      }

      const roomNotifications = await this.roomNotificationModel.find({
        room: { $in: roomIds },
        user: userId,
      });

      if (roomNotifications && roomNotifications.length > 0) {
        await this.roomNotificationModel.deleteMany({
          room: { $in: roomIds },
          user: userId,
        });
      } else {
        const newNotifications = roomIds.map((roomId) => ({
          room: roomId,
          user: userId,
        }));
        await this.roomNotificationModel.insertMany(newNotifications);
      }
    } catch (error) {
      throw new Error('Error toggling station notification');
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
