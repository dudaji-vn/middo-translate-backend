import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { BotsService } from './bots.service';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateBotDto } from './dto/create-bot.dto';
import { AccessControlDto } from './dto/access-control.dto';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  async createBot(@Body() payload: CreateBotDto) {
    const result = await this.botsService.createBot(payload);
    return { data: result };
  }

  @Put('access-control')
  async accessControl(
    @Body() payload: AccessControlDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.botsService.updateAccessControl(payload, userId);
    return { data: result };
  }

  @Get('summarize/:botId/:stationId')
  async getSummarizeContent(
    @ParamObjectId('stationId') stationId: string,
    @JwtUserId() userId: string,
    @ParamObjectId('botId') botId: string,
  ) {
    const result = await this.botsService.getSummarizeContent(
      botId,
      stationId,
      userId,
    );
    return { data: result };
  }

  @Get(':stationId')
  async getBotsByUser(
    @ParamObjectId('stationId') stationId: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.botsService.getBotsByUser(stationId, userId);
    return { data: result };
  }
}
