import { Injectable } from '@nestjs/common';
import { FindParams } from 'src/common/types';
import { RoomsService } from 'src/rooms/rooms.service';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { SearchMainResult } from './types';
import { AddKeywordDto } from './dtos/add-keyword-dto';
import { InjectModel } from '@nestjs/mongoose';
import { Search } from './schemas/search.schema';
import { Model } from 'mongoose';
import { KeywordQueryParamsDto } from './dtos/keyword-query-params.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Search.name)
    private searchModel: Model<Search>,
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
  ) {}

  async searchInbox(
    { q, limit, type, spaceId }: FindParams,
    userId: string,
  ): Promise<SearchMainResult> {
    const users = await this.searchUsers({ q, limit, type });

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
      };
    }
    return {
      users,
      rooms,
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

  async checkKeyword(
    userId: string,
    keyword: string,
    payload: KeywordQueryParamsDto,
  ) {
    const { spaceId, stationId } = payload;
    const data = await this.searchModel.exists({
      'keywords.keyword': keyword,
      user: userId,
      ...(spaceId && { space: spaceId }),
      ...(stationId && { station: stationId }),
    });
    return !!data;
  }

  async addKeyword(userId: string, payload: AddKeywordDto) {
    const { keyword, spaceId, stationId } = payload;
    const filter = {
      user: userId,
      ...(spaceId && { space: spaceId }),
      ...(stationId && { station: stationId }),
    };

    const result = await this.searchModel.findOne(filter);
    const keywordIndex = result?.keywords
      ? result?.keywords.findIndex((item: any) => item.keyword === keyword)
      : -1;

    if (!result || keywordIndex === -1) {
      return await this.searchModel.findOneAndUpdate(
        filter,
        {
          $push: { keywords: { keyword: keyword } },
        },
        {
          upsert: true,
          new: true,
        },
      );
    } else {
      result.keywords[keywordIndex] = { keyword: keyword };
      await result.save();
      return result;
    }
  }

  async getKeywords(userId: string, query: KeywordQueryParamsDto) {
    const { spaceId, stationId } = query;
    const data = await this.searchModel
      .findOne({
        user: userId,
        ...(spaceId && { space: spaceId }),
        ...(stationId && { station: stationId }),
      })
      .lean();

    if (!data || !data?.keywords) {
      return [];
    }

    return data.keywords.sort(
      (a: any, b: any) =>
        new Date(b?.updatedAt).getTime() - new Date(a?.updatedAt).getTime(),
    );
  }
}
