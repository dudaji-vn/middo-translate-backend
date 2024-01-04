import { Body, Controller, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtUserId } from 'src/common/decorators';
import { SubscribeDto } from './dto/subscribe.dto';

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
}
