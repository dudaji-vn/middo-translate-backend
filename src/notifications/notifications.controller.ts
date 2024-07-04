import { Body, Controller, Get, Post } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { SubscribeDto } from './dto/subscribe.dto';
import { CheckSubscribedDto } from './dto/check-subscribed.dto';
import { Response } from 'src/common/types';
import { ToggleRoomNotificationDto } from './dto/toggle-room-notification';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('/subscribe')
  async subscribe(
    @JwtUserId() userId: string,
    @Body() subscribeDTo: SubscribeDto,
  ) {
    {
      await this.notificationService.storageToken(
        userId,
        subscribeDTo.token,
        subscribeDTo.type,
      );
      return {
        data: null,
        message: 'Subscribe successfully',
      };
    }
  }
  @Post('/unsubscribe')
  async unsubscribe(
    @JwtUserId() userId: string,
    @Body() subscribeDTo: SubscribeDto,
  ) {
    {
      await this.notificationService.deleteToken(
        userId,
        subscribeDTo.token,
        subscribeDTo.type,
      );
      return {
        data: null,
        message: 'Unsubscribe successfully',
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
      checkSubscribedDto.type,
    );
    return {
      data: isSubscribed,
      message: 'Check subscribed successfully',
    };
  }

  @Post('room/toggle')
  async toggleNotification(
    @Body() toggleRoomNotificationDto: ToggleRoomNotificationDto,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    await this.notificationService.toggleNotification(
      toggleRoomNotificationDto.roomId,
      userId,
    );
    return { message: 'Notification toggled', data: null };
  }
  @Post('room/:roomId/check')
  async checkRoomNotification(
    @ParamObjectId('roomId') roomId: string,
    @JwtUserId() userId: string,
  ): Promise<
    Response<{
      isMuted: boolean;
    }>
  > {
    const isMuted = await this.notificationService.checkIsUserIgnoringRoom(
      roomId,
      userId,
    );
    return {
      message: 'Notification toggled',
      data: {
        isMuted,
      },
    };
  }

  @Post('stations/:stationId/toggle')
  async toggleStationNotification(
    @JwtUserId() userId: string,
    @ParamObjectId('stationId') stationId: string,
  ): Promise<Response<null>> {
    await this.notificationService.toggleStationNotification(stationId, userId);
    return { message: 'Station notification toggled', data: null };
  }
}
