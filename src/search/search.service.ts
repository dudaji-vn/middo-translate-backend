import { BadRequestException, Injectable } from '@nestjs/common';
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
import { MessagesService } from 'src/messages/messages.service';
import { SearchCountResult } from './types/search-count-result.type';

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
    const translationsKey = `translations.en`;

    const messages = await this.messagesService.search({
      query: {
        room: roomIds,
        removedFor: { $nin: userId },
        $or: [
          {
            [translationsKey]: { $regex: q, $options: 'i' },
          },
          {
            content: { $regex: q, $options: 'i' },
          },
        ],
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
        messages,
      };
    }

    return {
      users,
      rooms,
      messages,
    };
  }

  async countSearchInbox(
    { q, limit, type, spaceId }: FindParams,
    userId: string,
  ): Promise<SearchCountResult> {
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
    const translationsKey = `translations.en`;

    const messages = await this.messagesService.search({
      query: {
        room: roomIds,
        removedFor: { $nin: userId },
        $or: [
          {
            [translationsKey]: { $regex: q, $options: 'i' },
          },
          {
            content: { $regex: q, $options: 'i' },
          },
        ],
      },
      limit,
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

  async addKeyword(userId: string, payload: AddKeywordDto) {
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
  ) {
    const data = await this.findKeywordsBy(userId, { ...payload, keyword });

    if (!data || !data.keywords) {
      throw new BadRequestException('keyword not found');
    }
    data.keywords = data.keywords.filter((item) => item.keyword !== keyword);
    await data.save();
    return true;
  }

  async deleteAllKeywords(userId: string, payload: KeywordQueryParamsDto) {
    const data = await this.findKeywordsBy(userId, payload);

    if (!data || !data.keywords) {
      throw new BadRequestException('keyword not found');
    }
    data.keywords = [];
    await data.save();
    return true;
  }
}
