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
import { CursorPaginationInfo, Pagination, Response } from 'src/common/types';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { SearchMainResult } from './types';
import { AddKeywordDto } from './dtos/add-keyword-dto';
import { KeywordQueryParamsDto } from './dtos/keyword-query-params.dto';
import { SearchCountResult } from './types/search-count-result.type';
import { Keyword } from './schemas/search.schema';
import { Message } from 'src/messages/schemas/messages.schema';
import { Room } from 'src/rooms/schemas/room.schema';
import { SearchQueryParamsCursorDto } from './dtos/search-query-params-cusor.dto';

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

  @Get('conversations')
  async searchConversationBy(
    @Query() query: SearchQueryParamsCursorDto,
    @JwtUserId() userId: string,
  ): Promise<
    Response<Pagination<User | Room | Message, CursorPaginationInfo>>
  > {
    const data = await this.searchService.searchConversationBy(query, userId);
    return { data, message: 'Search conversations' };
  }

  @Get('inboxes/count')
  async countSearchInbox(
    @JwtUserId() userId: string,
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<SearchCountResult>> {
    query.limit = Infinity;
    const data = await this.searchService.countSearchInbox(query, userId);
    return {
      data,
      message: 'Count search inbox',
    };
  }

  @Get('rooms/:id/messages')
  async searchInRoom(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<Message[]>> {
    const data = await this.searchService.searchMessageInRoom(
      id,
      userId,
      query,
    );
    return {
      data,
      message: 'Search messages in room',
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

  @Get('users/username')
  async searchByUserName(
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<User[]>> {
    query.limit = query.limit || 20;
    const users = await this.searchService.searchByUsername(query);
    return {
      data: users,
      message: 'Users found',
    };
  }

  @Post('keywords')
  async addKeyword(
    @JwtUserId() userId: string,
    @Body() payload: AddKeywordDto,
  ): Promise<Response<Keyword[]>> {
    const result = await this.searchService.addKeyword(userId, payload);
    return {
      data: result,
      message: 'Add keyword',
    };
  }

  @Get('keywords')
  async getKeywords(
    @JwtUserId() userId: string,
    @Query() query: KeywordQueryParamsDto,
  ): Promise<Response<Keyword[]>> {
    const result = await this.searchService.getKeywords(userId, query);
    return {
      data: result,
      message: 'get keywords',
    };
  }

  @Get('keywords/:keyword')
  async checkKeyword(
    @JwtUserId() userId: string,
    @Param('keyword') keyword: string,
    @Query() query: KeywordQueryParamsDto,
  ): Promise<Response<boolean>> {
    const result = await this.searchService.checkKeyword(
      userId,
      keyword,
      query,
    );
    return {
      data: result,
      message: 'Check keyword',
    };
  }

  @Delete('keywords/:keyword')
  async deleteKeyword(
    @JwtUserId() userId: string,
    @Param('keyword') keyword: string,
    @Query() query: KeywordQueryParamsDto,
  ): Promise<Response<null>> {
    const result = await this.searchService.deleteKeyword(
      userId,
      keyword,
      query,
    );
    return {
      data: result,
      message: 'Delete keyword',
    };
  }

  @Delete('keywords')
  async deleteAllKeywords(
    @JwtUserId() userId: string,
    @Query() query: KeywordQueryParamsDto,
  ): Promise<Response<null>> {
    const result = await this.searchService.deleteAllKeywords(userId, query);
    return {
      data: result,
      message: 'Delete all keywords',
    };
  }
}
