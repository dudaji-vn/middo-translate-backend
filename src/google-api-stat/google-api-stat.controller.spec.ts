import { Test, TestingModule } from '@nestjs/testing';
import { GoogleApiStatController } from './google-api-stat.controller';

describe('GoogleApiStatController', () => {
  let controller: GoogleApiStatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleApiStatController],
    }).compile();

    controller = module.get<GoogleApiStatController>(GoogleApiStatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
