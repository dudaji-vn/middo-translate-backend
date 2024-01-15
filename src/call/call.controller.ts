import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JwtUserId } from 'src/common/decorators';
import { CallService } from './call.service';

@Controller('call')
export class CallController {
  constructor(private readonly callService: CallService) {}
  @Post()
  async createVideoCallRoom(
    @JwtUserId() userId: string,
    @Body() { roomId }: { roomId: string },
  ) {
    const result = await this.callService.joinVideoCallRoom({
      id: userId,
      roomId: roomId,
    });
    return { data: result };
  }
  @Post('check-is-have-meeting')
  async checkIsHaveMeeting(@Body() { roomId }: { roomId: string }) {
    const result = await this.callService.checkIsHaveMeeting(roomId);
    return { data: result };
  }
  @Post('get-call-info')
  async getCallInfo(
    @JwtUserId() userId: string,
    @Body() { roomId }: { roomId: string },
  ) {
    const result = await this.callService.getCallInfo({ roomId });
    return { data: result };
  }
}
