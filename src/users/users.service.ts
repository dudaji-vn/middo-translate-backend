import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, PipelineStage, Types } from 'mongoose';
import { FindParams } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import {
  Provider,
  User,
  UserRelationType,
  UserStatus,
} from './schemas/user.schema';
import { generateAvatar, selectPopulateField } from 'src/common/utils';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { UserHelpDeskResponse } from './dto/user-help-desk-response.dto';
import { logger } from 'src/common/utils/logger';
import { Space, StatusSpace } from 'src/help-desk/schemas/space.schema';
import { MESSAGE_RESPONSE } from 'src/common/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { socketConfig } from 'src/configs/socket.config';
import { SearchQueryParams } from 'src/search/types';
import { Station } from 'src/stations/schemas/station.schema';
import { queryClients } from 'src/common/utils/query-report';
import { generateSlug } from 'src/common/utils/generate-slug';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Space.name) private spaceModel: Model<Space>,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async getProfile(id: string) {
    const user = await this.userModel
      .findById(id)
      .populate(
        'defaultStation',
        selectPopulateField<Station>(['name', 'avatar']),
      )
      .select(
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
          'status',
          'pinRoomIds',
          'username',
          'allowUnknown',
          'defaultStation',
        ]),
      )
      .lean();
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    return user;
  }
  async find({ q, limit, stationId }: FindParams): Promise<User[]> {
    const users = await this.userModel
      .find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          {
            username: { $regex: q, $options: 'i' },
          },
        ],
        status: UserStatus.ACTIVE,
        ...(stationId && {
          stations: stationId,
        }),
      })
      .limit(limit)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
        tempEmail: true,
        pinRoomIds: true,
      })
      .lean();
    return users;
  }

  async findByUsername({ q, limit, stationId }: FindParams): Promise<User[]> {
    const users = await this.userModel
      .find({
        username: q,
        status: UserStatus.ACTIVE,
      })
      .limit(limit)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
        pinRoomIds: true,
      })
      .lean();
    return users;
  }
  async findById(id: ObjectId | string) {
    const user = await this.userModel
      .findById(id)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
        pinRoomIds: true,
        status: true,
        blacklist: true,
        allowUnknown: true,
        language: true,
      })
      .lean();
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    return user;
  }

  async findManyByIds(ids: ObjectId[] | string[]) {
    if (!ids.length) {
      return [];
    }
    const users = await this.userModel
      .find({
        _id: {
          $in: ids,
        },
      })
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
      })
      .lean();
    return users;
  }

  async findByEmail(
    email: string,
    options?: {
      notFoundMessage?: string;
      notFoundCode?: number;
      ignoreNotFound?: boolean;
    },
  ) {
    const regex = new RegExp('^' + email.trim() + '$', 'i');
    const user = await this.userModel
      .findOne({ email: { $regex: regex } })
      .lean();
    if (!user && options?.ignoreNotFound) {
      return {} as User;
    }
    if (!user) {
      const message = options?.notFoundMessage || `User not found`;
      const code = options?.notFoundCode || 404;
      throw new HttpException(message, code);
    }
    return user;
  }

  async findManyByEmails(emails: string[]) {
    const users = await this.userModel
      .find({ email: { $in: emails } })
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
      })
      .lean();
    return users;
  }

  async create(info: Partial<User>) {
    const user = await this.userModel.create(info);
    return user;
  }

  async isEmailExist(email: string) {
    const res = await this.userModel.exists({
      email: { $regex: email, $options: 'i' },
    });
    return !!res;
  }

  async isUsernameExist(username: string) {
    const res = await this.userModel.exists({
      username: username,
    });
    return !!res;
  }

  async generateUsernameByEmail(email: string) {
    const emailPrefix = email.split('@')[0];
    let username = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const maxLength = 15;
    if (username.length > maxLength) {
      username = username.slice(0, maxLength);
    }
    let isExist = await this.isUsernameExist(username);
    if (isExist) {
      let i = 1;
      const baseLength = username.length;
      while (isExist) {
        const suffixLength = String(i).length + 1; // Adding 1 for the extra character between username and i
        const remainingLength = maxLength - baseLength - suffixLength;
        const truncatedUsername = username.slice(0, remainingLength);
        username = `${truncatedUsername}${i}`;
        isExist = await this.isUsernameExist(username);
        i++;
      }
    }
    return username;
  }

  async update(id: ObjectId | string, info: Partial<User>) {
    if (info.username) {
      const isExist = await this.isUsernameExist(info.username);
      if (isExist) {
        throw new HttpException(
          `Username ${info.username} is already taken`,
          403,
        );
      }
    }
    const user = await this.userModel.findByIdAndUpdate(id, info, {
      new: true,
    });
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    return user;
  }

  async checkUsernameIsExist(username: string) {
    const isExist = await this.isUsernameExist(username);
    if (isExist) {
      throw new HttpException(MESSAGE_RESPONSE.USERNAME_EXIST, 403);
    }
    return true;
  }

  async setUpInfo(id: string, info: SetupInfoDto): Promise<User> {
    if (!info.avatar) {
      info.avatar = generateAvatar(info.name);
    }
    await this.checkUsernameIsExist(info.username);
    const user = await this.userModel.findByIdAndUpdate(
      id,
      {
        ...info,
        status: UserStatus.ACTIVE,
      },
      {
        new: true,
      },
    );
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    return user;
  }

  async updateUserInfo(id: string, info: UpdateUserDto): Promise<User> {
    try {
      const userUpdate = await this.findById(id);
      if (info.username && info.username !== userUpdate.username) {
        const isExist = await this.isUsernameExist(info.username);
        if (isExist) {
          throw new HttpException(MESSAGE_RESPONSE.USERNAME_EXIST, 403);
        }
      }
      const user = await this.userModel.findByIdAndUpdate(
        id,
        {
          ...info,
        },
        {
          new: true,
        },
      );
      if (!user) {
        throw new HttpException(`Please re-login and try again later!`, 404);
      }
      return user;
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 172: ${error['message']}`,
        '',
        UsersService.name,
      );
      throw error;
    }
  }

  async changePassword(id: string, info: ChangePasswordDto): Promise<void> {
    try {
      const user = await this.userModel.findById(id).lean();
      if (!user) {
        throw new HttpException('Please re-login and try again later!', 404);
      }
      const isMatch = await bcrypt.compare(info.currentPassword, user.password);
      if (!isMatch) {
        throw new HttpException(MESSAGE_RESPONSE.INVALID_PASSWORD, 400);
      }
      const newPassword = await bcrypt.hash(info.newPassword, 10);
      await this.userModel.findByIdAndUpdate(id, {
        password: newPassword,
      });
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 196: ${error['message']}`,
        '',
        UsersService.name,
      );
      throw error;
    }
  }
  async getClientsByUser({
    q,
    limit = 5,
    spaceId,
    userId,
    currentPage = 1,
  }: FindParams & {
    spaceId: string;
    userId: string;
  }): Promise<UserHelpDeskResponse> {
    const query = queryClients({
      params: {
        spaceId,
        q,
      },
    });
    const totalItemsPromise = this.userModel.aggregate([
      ...query,
      { $count: 'totalCount' },
    ]);

    const queryCurrentData = [
      {
        $sort: {
          'room.createdAt': -1,
        },
      } as PipelineStage,
      {
        $skip: (currentPage - 1) * limit,
      },
      {
        $limit: limit,
      },
      {
        $project: {
          name: 1,
          email: '$tempEmail',
          phoneNumber: '$phoneNumber',
          firstConnectDate: '$room.createdAt',
          lastConnectDate: '$room.newMessageAt',
        },
      },
    ];
    const dataPromise = this.userModel.aggregate([
      ...query,
      ...queryCurrentData,
    ]);

    const [totalItems, data] = await Promise.all([
      totalItemsPromise,
      dataPromise,
    ]);

    const totalPage = totalItems[0]?.totalCount || 0;
    return {
      totalPage: Math.ceil(totalPage / limit),
      items: data,
    };
  }
  async findBySpaceAndCountries(spaceId: string, countries: string[]) {
    return await this.userModel
      .find({
        space: spaceId,
        language: { $in: countries },
      })
      .lean();
  }
  async delete(id: string) {
    const deletedEmail = `deleted${id}@mail.com`;
    const username = await this.generateUsernameByEmail(deletedEmail);
    const user = await this.userModel.updateOne(
      { _id: id },
      {
        status: UserStatus.DELETED,
        avatar: '',
        name: 'User',
        email: deletedEmail,
        bio: '',
        blacklist: [],
        pinRoomIds: [],
        verifyToken: '',
        provider: Provider.LOCAL,
        username: username,
      },
    );
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    await this.deleteSpacesIfExistByOwner(id);
    return user;
  }

  async updateAllUsername() {
    // const users = await this.userModel.find();
    // for (const user of users) {
    //   if (!user.username) {
    //     const username = await this.generateUsernameByEmail(user.email);
    //     await this.userModel.findByIdAndUpdate(user._id, {
    //       username: username,
    //     });
    //   }
    // }
    await this.userModel.updateMany(
      {},
      {
        allowUnknown: true,
      },
    );
  }

  async deleteSpacesIfExistByOwner(userId: string) {
    await this.spaceModel.updateMany(
      {
        owner: userId,
      },
      {
        status: StatusSpace.DELETED,
      },
    );
  }

  async blockUser(userId: string, blockUserId: string) {
    const user = await this.findById(userId);
    const blockUser = await this.findById(blockUserId);
    if (!blockUser) {
      throw new HttpException(`User ${blockUserId} not found`, 404);
    }
    if (user?.blacklist?.includes(blockUserId)) {
      throw new HttpException(`User ${blockUserId} already blocked`, 400);
    }
    user?.blacklist?.push(blockUserId);
    await this.update(userId, { blacklist: user?.blacklist });
    this.eventEmitter.emit(socketConfig.events.user.relationship.update, {
      userIds: [userId, blockUserId],
    });
    return user;
  }
  async unblockUser(userId: string, blockUserId: string) {
    const user = await this.findById(userId);
    const blockUser = await this.findById(blockUserId);
    if (!blockUser) {
      throw new HttpException(`User ${blockUserId} not found`, 404);
    }
    if (!user?.blacklist?.includes(blockUserId)) {
      throw new HttpException(`User ${blockUserId} not blocked`, 400);
    }
    user.blacklist = user?.blacklist?.filter((id) => id !== blockUserId) || [];
    await this.update(userId, { blacklist: user.blacklist });
    this.eventEmitter.emit(socketConfig.events.user.relationship.update, {
      userIds: [userId, blockUserId],
    });
    return user;
  }

  async toggleAllowUnknown(userId: string) {
    const user = await this.findById(userId);
    const isAllow = user?.allowUnknown || false;
    await this.update(userId, { allowUnknown: !isAllow });
    return !isAllow;
  }

  async checkRelationship(userId: string, targetId: string) {
    if (userId === targetId) {
      return UserRelationType.NONE;
    }
    const user = await this.findById(userId);
    const target = await this.findById(targetId);
    if (user?.blacklist?.includes(targetId)) {
      return UserRelationType.BLOCKING;
    }
    if (target?.blacklist?.includes(userId)) {
      return UserRelationType.BLOCKED;
    }
    return UserRelationType.NONE;
  }

  search({ query, params }: SearchQueryParams<User>) {
    const { limit, q, spaceId, stationId } = params;
    return this.userModel
      .find({
        status: spaceId ? UserStatus.ANONYMOUS : UserStatus.ACTIVE,
        ...(spaceId && { space: spaceId }),
        ...(stationId && { stations: stationId }),
        $or: [
          { name: { $regex: q, $options: 'i' } },
          {
            username: { $regex: q, $options: 'i' },
          },
        ],
        ...query,
      })
      .limit(limit)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
        tempEmail: true,
        createdAt: true,
      })
      .lean();
  }

  async addMemberToStation(userId: string, stationId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { stations: stationId } },
      {
        new: true,
      },
    );
    if (!user) {
      throw new HttpException(`User ${userId} not found`, 404);
    }
    return user;
  }

  async removeMemberFromStation(userId: string, stationId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { stations: stationId } },
      {
        new: true,
      },
    );
    if (!user) {
      throw new HttpException(`User ${userId} not found`, 404);
    }
    return user;
  }

  async removeStationFromUser(stationId: string) {
    await this.userModel.updateMany(
      { defaultStation: stationId },
      { defaultStation: null },
    );

    await this.userModel.updateMany(
      { stations: stationId },
      { $pull: { stations: stationId } },
    );
    return null;
  }

  async createAnonymousUser(name: string, language: string) {
    const slug = generateSlug();
    return await this.userModel.create({
      status: UserStatus.ANONYMOUS,
      email: `${slug}@gmail.com`,
      username: `${slug}`,
      name: name,
      language: language,
    });
  }
}
