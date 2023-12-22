import { Controller, Get } from '@nestjs/common';
import { JwtUserId } from 'src/common/decorators';
import { RecommendationService } from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}
  @Get('/chat')
  async getRecommendUsersBasedRecentlyChat(@JwtUserId() userId: string) {
    const users =
      await this.recommendationService.getRecommendUsersBasedRecentlyChat(
        userId,
      );
    return {
      data: users,
      message: 'Recommendation users',
    };
  }
}
