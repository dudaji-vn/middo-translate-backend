import { Controller, Get, Post } from '@nestjs/common';
import { BotsService } from './bots.service';
import { ParamObjectId } from '../common/decorators';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  createBot() {
    return 'Create bot feature';
  }

  @Get(':id/content/:teamId')
  getContent(
    @ParamObjectId('id') id: string,
    @ParamObjectId('teamId') teamId: string,
  ) {
    return this.botsService.generateContent(id, teamId);
  }
}
