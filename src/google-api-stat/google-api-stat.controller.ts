import { Controller, Get, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators';
import { Response } from 'src/common/types';

class GoogleApiStat {
  total: number;
  languages: number;
  detect: number;
  translate: number;
  createdAt: Date;

  constructor() {
    this.total = 0;
    this.languages = 0;
    this.detect = 0;
    this.translate = 0;
    this.createdAt = new Date();
  }

  public getData() {
    return {
      total: this.total,
      translate: this.translate,
      detect: this.detect,
      languages: this.languages,
      createdAt: this.createdAt,
    };
  }

  public increaseTranslate() {
    this.total++;
    this.translate++;
  }

  public increaseLanguages() {
    this.total++;
    this.languages++;
  }

  public increaseDetect() {
    this.total++;
    this.detect++;
  }
}

const statInstance = new GoogleApiStat();

@Controller('google-api-stat')
export class GoogleApiStatController {
  @Public()
  @Get('')
  async getGoogleApiStat(): Promise<Response<{}>> {
    return {
      message: 'GoogleApiStat Get Response',
      data: statInstance.getData(),
    };
  }

  @Public()
  @Post('translate')
  async postTranslate(): Promise<Response<null>> {
    statInstance.increaseTranslate();
    return {
      message: 'GoogleApiStat Post Response',
      data: null,
    };
  }

  @Public()
  @Post('languages')
  async postLanguages(): Promise<Response<null>> {
    statInstance.increaseLanguages();
    return {
      message: 'GoogleApiStat Post Response',
      data: null,
    };
  }

  @Public()
  @Post('detect')
  async postDetect(): Promise<Response<null>> {
    statInstance.increaseDetect();
    return {
      message: 'GoogleApiStat Post Response',
      data: null,
    };
  }
}
