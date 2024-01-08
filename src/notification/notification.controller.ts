import { Body, Controller, Get, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtUserId } from 'src/common/decorators';
import { SubscribeDto } from './dto/subscribe.dto';
import { CheckSubscribedDto } from './dto/check-subscribed.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('/subscribe')
  async subscribe(
    @JwtUserId() userId: string,
    @Body() subscribeDTo: SubscribeDto,
  ) {
    {
      await this.notificationService.storageToken(userId, subscribeDTo.token);
      return {
        data: null,
        message: 'Subscribe successfully',
      };
    }
  }
  // get all subscriptions of user
  @Get('/devices')
  async getSubscriptions(@JwtUserId() userId: string) {
    const subscriptions = await this.notificationService.getDevices(userId);
    return {
      data: subscriptions,
      message: 'Get subscriptions successfully',
    };
  }

  // check if user has subscribed to notification
  @Post('/check')
  async checkSubscribed(
    @JwtUserId() userId: string,
    @Body() checkSubscribedDto: CheckSubscribedDto,
  ) {
    const isSubscribed = await this.notificationService.checkSubscription(
      userId,
      checkSubscribedDto.token,
    );
    return {
      data: isSubscribed,
      message: 'Check subscribed successfully',
    };
  }
}
