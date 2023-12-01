import { Test, TestingModule } from '@nestjs/testing';
import { Rooms } from './rooms';

describe('Rooms', () => {
  let provider: Rooms;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Rooms],
    }).compile();

    provider = module.get<Rooms>(Rooms);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
