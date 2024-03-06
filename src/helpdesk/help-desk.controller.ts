import { Controller } from '@nestjs/common';
import { HelpDeskService } from './help-desk.service';

@Controller('messages')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}
}
