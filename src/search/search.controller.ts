import { Controller, Get, Query } from '@nestjs/common';
import { SearchQueryParamsDto } from './dtos/search-query-params.dto';
import { SearchService } from './search.service';
import { User } from 'src/users/schemas/user.schema';
import { Response } from 'src/common/types';
import { JwtUserId } from 'src/common/decorators';
import { SearchMainResult } from './types';
import { HelpDeskClient } from '../helpdesk/schemas/help-desk-client.schema';

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

  @Get('help-desk')
  async searchHelpDesk(
    @Query() query: SearchQueryParamsDto,
  ): Promise<Response<Partial<User>[]>> {
    query.limit = query.limit || 20;
    const users = await this.searchService.searchHelpDesk(query);
    return {
      data: users,
      message: 'Users found',
    };
  }
}
