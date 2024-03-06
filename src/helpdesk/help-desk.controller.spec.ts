import { Test, TestingModule } from '@nestjs/testing';
import { HelpDeskController } from './help-desk.controller';

describe('MessagesController', () => {
  let controller: HelpDeskController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpDeskController],
    }).compile();

    controller = module.get<HelpDeskController>(HelpDeskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
