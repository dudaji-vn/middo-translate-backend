import { Controller, Get, Query } from '@nestjs/common';
import { JwtUserId } from 'src/common/decorators';
import { RecommendQueryDto } from './dto/recommend-query-dto';
import { RecommendationService } from './recommendation.service';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}
  @Get('/chat/users')
  async getRecommendUsersBasedRecentlyChat(
    @JwtUserId() userId: string,
    @Query() query: RecommendQueryDto,
  ) {
    const users =
      await this.recommendationService.getRecommendUsersBasedRecentlyChat(
        userId,
        query,
      );
    return {
      data: users,
      message: 'Recommendation users',
    };
  }

  @Get('/chat')
  async getRecommend(
    @Query() query: RecommendQueryDto,
    @JwtUserId() userId: string,
  ) {
    const rooms =
      await this.recommendationService.getRecommendBasedRecentlyChat(
        userId,
        query,
      );
    return {
      data: rooms,
      message: 'Recommendation rooms',
    };
  }
}
