import { BadRequestException, Injectable } from '@nestjs/common';
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
      .select('-to');
    return notifications;
  }

  async readNotification(id: string) {
    const notification = await this.appNotificationModel.findById(id);
    if (!notification) {
      throw new BadRequestException('id not exist');
    }
    notification.unRead = false;
    await notification.save();
    return notification;
  }
  async deleteNotification(id: string, userId: string) {
    const notification = await this.appNotificationModel.findById(id);
    if (!notification) {
      throw new BadRequestException('Notification not found');
    }
    if (userId !== notification.to.toString()) {
      throw new BadRequestException(
        'You do not have permission to delete notifications',
      );
    }
    notification.isDeleted = true;
    await notification.save();
    return null;
  }
}
