import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAppNotificationDto } from './dto/create-app-notification.dto';
import { AppNotification } from './schemas/app-notification.schema';

@Injectable()
export class AppNotificationsService {
  constructor(
    @InjectModel(AppNotification.name)
    private appNotificationModel: Model<AppNotification>,
  ) {}

  async create(createAppNotificationDto: CreateAppNotificationDto) {
    return await this.appNotificationModel.create(createAppNotificationDto);
  }

  async getNotifications(userId: string) {
    const notifications = await this.appNotificationModel
      .find({
        to: userId,
        isDeleted: { $ne: true },
      })
      .sort({ _id: -1 })
      .populate('from', 'name avatar')
      .populate('space')
      .select('-to');
    return notifications;
  }
}
