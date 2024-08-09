import { Body, Controller, Get, Post, Put, Query, Res } from '@nestjs/common';
import { BotsService } from './bots.service';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateBotDto } from './dtos/create-bot.dto';
import { AccessControlDto } from './dtos/access-control.dto';
import { SummarizeContentDto } from './dtos/summary-content.dto';
import { Response } from 'express';

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

  @Post('summarize')
  async summarizeContent(
    @Body() payload: SummarizeContentDto,
    @JwtUserId() userId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');

    try {
      const stream = await this.botsService.summarizeContent(payload, userId);
      stream.getStream().pipe(res);
      stream.getStream().on('end', () => {
        res.end();
      });
    } catch (err) {
      console.error('Error in summarizeContent:', err);
      res.status(500).send('Failed to retrieve summary');
    }
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
