import { Controller, Delete, Get, Param } from '@nestjs/common';
import { JwtUserId } from 'src/common/decorators';
import { AppNotificationsService } from './app-notifications.service';

@Controller('app-notifications')
export class AppNotificationsController {
  constructor(
    private readonly appNotificationsService: AppNotificationsService,
  ) {}

  @Get()
  findAll(@JwtUserId() userId: string) {
    return this.appNotificationsService.getNotifications(userId);
  }
}
