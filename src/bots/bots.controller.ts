import { Body, Controller, Get, Post } from '@nestjs/common';
import { BotsService } from './bots.service';
import { ParamObjectId } from '../common/decorators';
import { CreateBotDto } from './dto/create-bot.dto';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  async createBot(@Body() payload: CreateBotDto) {
    const result = await this.botsService.createBot(payload);
    return { data: result };
  }

  @Get(':id/content/:teamId')
  getContent(
    @ParamObjectId('id') id: string,
    @ParamObjectId('teamId') teamId: string,
  ) {
    return this.botsService.generateContent(id, teamId);
  }
}
