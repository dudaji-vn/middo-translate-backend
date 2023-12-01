import { Test, TestingModule } from '@nestjs/testing';
import { Messages } from './messages';

describe('Messages', () => {
  let provider: Messages;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Messages],
    }).compile();

    provider = module.get<Messages>(Messages);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
