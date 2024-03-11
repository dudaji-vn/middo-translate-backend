import { Test, TestingModule } from '@nestjs/testing';
import { HelpDeskService } from './help-desk.service';

describe('HelpDeskService', () => {
  let service: HelpDeskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HelpDeskService],
    }).compile();

    service = module.get<HelpDeskService>(HelpDeskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
