import { Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { AppNotificationsService } from './app-notifications.service';

@Controller('app-notifications')
export class AppNotificationsController {
  constructor(
    private readonly appNotificationsService: AppNotificationsService,
  ) {}

  @Get()
  async findAll(@JwtUserId() userId: string) {
    const result = await this.appNotificationsService.getNotifications(userId);
    return {
      data: result,
    };
  }

  @Patch('read/:id')
  async readNotification(@ParamObjectId('id') id: string) {
    const result = await this.appNotificationsService.readNotification(id);
    return {
      data: result,
    };
  }

  @Delete(':id')
  async deleteNotification(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    const result = await this.appNotificationsService.deleteNotification(
      id,
      userId,
    );
    return {
      data: result,
    };
  }
}
