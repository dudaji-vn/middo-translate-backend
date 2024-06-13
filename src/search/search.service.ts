import { BadRequestException, Injectable } from '@nestjs/common';
import { CursorPaginationInfo, FindParams, Pagination } from 'src/common/types';
import { RoomsService } from 'src/rooms/rooms.service';
import { Room, RoomStatus } from 'src/rooms/schemas/room.schema';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { SearchMainResult } from './types';
import { AddKeywordDto } from './dtos/add-keyword-dto';
import { InjectModel } from '@nestjs/mongoose';
import { Keyword, Search } from './schemas/search.schema';
import { Model } from 'mongoose';
import { KeywordQueryParamsDto } from './dtos/keyword-query-params.dto';
import { MessagesService } from 'src/messages/messages.service';
import { SearchCountResult } from './types/search-count-result.type';
import { selectPopulateField } from 'src/common/utils';
import { Message } from '../messages/schemas/messages.schema';
import { SearchQueryParamsCursorDto } from './dtos/search-query-params-cusor.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Search.name)
    private searchModel: Model<Search>,
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
  ) {}

  async searchInbox(
    { q, limit, type, spaceId }: FindParams,
    userId: string,
  ): Promise<SearchMainResult> {
    const users = await this.usersService
      .search({
        params: {
          limit,
          q,
        },
      })
      .sort({ _id: -1 });

    const userIds = users.map((u) => u._id);

    const rooms = await this.roomsService
      .search({
        query: {
          ...(type === 'help-desk' && {
            isHelpDesk: true,
            space: { $exists: true, $eq: spaceId },
          }),
          $or: [
            {
              name: { $regex: q, $options: 'i' },
              participants: userId,
            },
            {
              $and: [
                {
                  participants: {
                    $in: [userId],
                  },
                },
                {
                  participants: {
                    $in: userIds,
                  },
                },
              ],
            },
          ],
          status: RoomStatus.ACTIVE,
          isGroup: type === 'help-desk' ? false : true,
        },
        limit,
      })
      .sort({ newMessageAt: -1 });

    const roomIds = await this.roomsService.findRoomIdsByQuery({
      query: {
        participants: userId,
        space: { $exists: false },
        station: { $exists: false },
        ...(spaceId && {
          isHelpDesk: true,
          space: { $exists: true, $eq: spaceId },
        }),
      },
    });

    const messages = await this.messagesService
      .search({
        query: {
          room: roomIds,
        },
        params: {
          q,
          userId,
          limit,
        },
      })
      .sort({ _id: -1 });

    if (type === 'help-desk') {
      return {
        users: [],
        rooms: rooms.map((item) => ({
          ...item,
          participants: item.participants.map((user) => ({
            ...user,
            email:
              user.status === UserStatus.ANONYMOUS
                ? user.tempEmail
                : user.email,
          })),
        })),
        messages,
      };
    }

    return {
      users,
      rooms,
      messages,
    };
  }

  async searchConversationBy(
    queryParams: SearchQueryParamsCursorDto,
    userId: string,
  ): Promise<Pagination<Room | User | Message, CursorPaginationInfo>> {
    const { limit, cursor, type, q, spaceId } = queryParams;

    const cursorDate = cursor
      ? new Date(cursor).toDateString()
      : new Date().toISOString();

    let data: any = [];

    switch (type) {
      case 'user':
        data = await this.usersService
          .search({
            query: {
              createdAt: {
                $lt: cursorDate,
              },
            },
            params: {
              limit,
              q,
            },
          })
          .sort({ _id: -1 });
        break;
      case 'group':
        const users = await this.usersService.search({
          query: {
            status: UserStatus.ACTIVE,
          },
          params: {
            limit: Infinity,
            q,
          },
        });
        const userIds = users.map((u) => u._id);

        data = await this.roomsService
          .search({
            query: {
              newMessageAt: {
                $lt: cursorDate,
              },
              space: { $exists: false },
              $or: [
                {
                  name: { $regex: q, $options: 'i' },
                  participants: userId,
                },
                {
                  $and: [
                    {
                      participants: {
                        $in: [userId],
                      },
                    },
                    {
                      participants: {
                        $in: userIds,
                      },
                    },
                  ],
                },
              ],
              status: RoomStatus.ACTIVE,
              isGroup: true,
            },
            limit,
          })
          .sort({ newMessageAt: -1 });
        break;
      case 'message':
        const roomIds = await this.roomsService.findRoomIdsByQuery({
          query: {
            participants: userId,
            space: { $exists: false },
            station: { $exists: false },
            ...(spaceId && {
              isHelpDesk: true,
              space: { $exists: true, $eq: spaceId },
            }),
          },
        });

        data = await this.messagesService
          .search({
            query: {
              room: roomIds,
              createdAt: {
                $lt: cursorDate,
              },
            },
            params: {
              q,
              userId,
              limit,
            },
          })
          .sort({ _id: -1 });

        break;
    }

    const pageInfo: CursorPaginationInfo = {
      endCursor:
        type === 'group'
          ? data[data.length - 1]?.newMessageAt?.toISOString()
          : data[data.length - 1]?.createdAt?.toISOString(),
      hasNextPage: data.length === limit,
    };

    return {
      items: data,
      pageInfo,
    };
  }

  async countSearchInbox(
    { q, limit, type, spaceId }: FindParams,
    userId: string,
  ): Promise<SearchCountResult> {
    if (q.trim().length === 0) {
      return {
        totalUsers: 0,
        totalGroups: 0,
        totalMessages: 0,
      };
    }
    const users = await this.usersService.search({
      params: {
        limit,
        q,
      },
    });

    const userIds = users.map((u) => u._id);

    const rooms = await this.roomsService.search({
      query: {
        ...(type === 'help-desk' && {
          isHelpDesk: true,
          space: { $exists: true, $eq: spaceId },
        }),
        $or: [
          {
            name: { $regex: q, $options: 'i' },
            participants: userId,
          },
          {
            $and: [
              {
                participants: {
                  $in: [userId],
                },
              },
              {
                participants: {
                  $in: userIds,
                },
              },
            ],
          },
        ],
        status: RoomStatus.ACTIVE,
        isGroup: type === 'help-desk' ? false : true,
      },
      limit,
    });

    const roomIds = await this.roomsService.findRoomIdsByQuery({
      query: {
        participants: userId,
        space: { $exists: false },
        station: { $exists: false },
        ...(spaceId && {
          isHelpDesk: true,
          space: { $exists: true, $eq: spaceId },
        }),
      },
    });

    const messages = await this.messagesService.search({
      query: {
        room: roomIds,
      },
      params: {
        q,
        userId,
        limit,
      },
    });

    return {
      totalUsers: users.length,
      totalGroups: rooms.length,
      totalMessages: messages.length,
    };
  }

  async searchUsers({ q, limit, type }: FindParams): Promise<User[]> {
    const users = await this.usersService.find({
      q,
      limit,
      type,
    });
    return users;
  }
  async searchMessageInRoom(
    roomId: string,
    userId: string,
    { q, limit }: FindParams,
  ): Promise<Message[]> {
    return await this.messagesService
      .search({
        query: {
          room: roomId,
        },
        params: {
          q,
          userId,
          limit,
        },
      })
      .sort({ _id: -1 });
  }

  findKeywordsBy(
    userId: string,
    query: KeywordQueryParamsDto & { keyword?: string },
  ) {
    const { spaceId, stationId, keyword } = query;
    return this.searchModel.findOne({
      user: userId,
      station: { $exists: false },
      space: { $exists: false },
      ...(keyword && { 'keywords.keyword': keyword }),
      ...(spaceId && { space: spaceId }),
      ...(stationId && { station: stationId }),
    });
  }

  async checkKeyword(
    userId: string,
    keyword: string,
    payload: KeywordQueryParamsDto,
  ) {
    const data = await this.findKeywordsBy(userId, {
      ...payload,
      keyword,
    }).lean();
    return !!data;
  }

  async addKeyword(userId: string, payload: AddKeywordDto): Promise<Keyword[]> {
    const { keyword, spaceId, stationId } = payload;
    const filter = {
      user: userId,
      station: { $exists: false },
      space: { $exists: false },
      ...(spaceId && { space: spaceId }),
      ...(stationId && { station: stationId }),
    };

    const result = await this.searchModel.findOne(filter);
    const keywordIndex = result?.keywords
      ? result?.keywords.findIndex((item: any) => item.keyword === keyword)
      : -1;

    if (!result || keywordIndex === -1) {
      const data = await this.searchModel.findOneAndUpdate(
        filter,
        {
          $push: { keywords: { keyword: keyword } },
        },
        {
          upsert: true,
          new: true,
        },
      );
      return data.keywords;
    } else {
      result.keywords[keywordIndex] = { keyword: keyword };
      await result.save();
      return result.keywords;
    }
  }

  async getKeywords(
    userId: string,
    query: KeywordQueryParamsDto,
  ): Promise<Keyword[]> {
    const data = await this.findKeywordsBy(userId, query).lean();

    if (!data || !data?.keywords) {
      return [];
    }

    return data.keywords.sort(
      (a: any, b: any) =>
        new Date(b?.updatedAt).getTime() - new Date(a?.updatedAt).getTime(),
    );
  }

  async deleteKeyword(
    userId: string,
    keyword: string,
    payload: KeywordQueryParamsDto,
  ): Promise<null> {
    const data = await this.findKeywordsBy(userId, { ...payload, keyword });

    if (!data || !data.keywords) {
      throw new BadRequestException('keyword not found');
    }
    data.keywords = data.keywords.filter((item) => item.keyword !== keyword);
    await data.save();
    return null;
  }

  async deleteAllKeywords(
    userId: string,
    payload: KeywordQueryParamsDto,
  ): Promise<null> {
    const data = await this.findKeywordsBy(userId, payload);

    if (!data || !data.keywords) {
      throw new BadRequestException('keyword not found');
    }
    data.keywords = [];
    await data.save();
    return null;
  }
}
