import { Injectable } from '@nestjs/common';

@Injectable()
export class BotsService {
  generateContent(id: string, teamId: string) {
    return 'Generate content';
  }
}
