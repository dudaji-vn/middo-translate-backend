import { Test, TestingModule } from '@nestjs/testing';
import { AppNotificationsController } from './app-notifications.controller';
import { AppNotificationsService } from './app-notifications.service';

describe('AppNotificationsController', () => {
  let controller: AppNotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppNotificationsController],
      providers: [AppNotificationsService],
    }).compile();

    controller = module.get<AppNotificationsController>(AppNotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
