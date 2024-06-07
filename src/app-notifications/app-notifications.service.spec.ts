import { Test, TestingModule } from '@nestjs/testing';
import { AppNotificationsService } from './app-notifications.service';

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppNotificationsService],
    }).compile();

    service = module.get<AppNotificationsService>(AppNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
