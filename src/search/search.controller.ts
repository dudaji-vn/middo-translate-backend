import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SearchQueryParamsDto } from './dtos/search-query-params.dto';
import { SearchService } from './search.service';
import { User } from 'src/users/schemas/user.schema';
import { Response } from 'src/common/types';
import { JwtUserId } from 'src/common/decorators';
import { SearchMainResult } from './types';
import { AddKeywordDto } from './dtos/add-keyword-dto';
import { KeywordQueryParamsDto } from './dtos/keyword-query-params.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get('inboxes')
  async searchInbox(
    @JwtUserId() userId: string,
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<SearchMainResult>> {
    query.limit = query.limit || 10;
    const data = await this.searchService.searchInbox(query, userId);
    return {
      data,
      message: 'Inboxes found',
    };
  }

  @Get('users')
  async searchUsers(
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<User[]>> {
    query.limit = query.limit || 20;
    const users = await this.searchService.searchUsers(query);
    return {
      data: users,
      message: 'Users found',
    };
  }

  @Post('keywords')
  async addKeyword(
    @JwtUserId() userId: string,
    @Body() payload: AddKeywordDto,
  ) {
    const result = await this.searchService.addKeyword(userId, payload);
    return {
      data: result,
    };
  }

  @Get('keywords')
  async getKeywords(
    @JwtUserId() userId: string,
    @Query() query: KeywordQueryParamsDto,
  ) {
    const result = await this.searchService.getKeywords(userId, query);
    return {
      data: result,
    };
  }

  @Get('keywords/:keyword')
  async checkKeyword(
    @JwtUserId() userId: string,
    @Param('keyword') keyword: string,
    @Query() query: KeywordQueryParamsDto,
  ) {
    const result = await this.searchService.checkKeyword(
      userId,
      keyword,
      query,
    );
    return {
      data: result,
    };
  }

  @Delete('keywords/:keyword')
  async deleteKeyword(
    @JwtUserId() userId: string,
    @Param('keyword') keyword: string,
    @Query() query: KeywordQueryParamsDto,
  ) {
    const result = await this.searchService.deleteKeyword(
      userId,
      keyword,
      query,
    );
    return {
      data: result,
    };
  }

  @Delete('keywords')
  async deleteAllKeywords(
    @JwtUserId() userId: string,
    @Query() query: KeywordQueryParamsDto,
  ) {
    const result = await this.searchService.deleteAllKeywords(userId, query);
    return {
      data: result,
    };
  }
}
