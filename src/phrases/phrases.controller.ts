import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';
import { PhrasesService } from './phrases.service';

@ApiTags('Phrases')
@Controller('phrases')
export class PhrasesController {
  constructor(private phrasesService: PhrasesService) {}
  @Public()
  @Post()
  async init(@Body() payload: Record<string, string[]>) {
    const data = await this.phrasesService.init(payload);
    return {
      message: 'Init phrase',
      data: data,
    };
  }

  @Get()
  async getPhrases() {
    return 'Hello';
  }
}
