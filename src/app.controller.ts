import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { Public } from './common/decorators';
import { COMMIT_SHA_BACKEND, LATEST_TAG } from './configs/commit-data';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('version')
  getVersion() {
    return {
      data: { tag: LATEST_TAG, commit: COMMIT_SHA_BACKEND },
    };
  }
}
