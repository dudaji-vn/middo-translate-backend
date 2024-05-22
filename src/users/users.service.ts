import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, Types } from 'mongoose';
import { FindParams } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import { Provider, User, UserStatus } from './schemas/user.schema';
import { generateAvatar, selectPopulateField } from 'src/common/utils';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { UserHelpDeskResponse } from './dto/user-help-desk-response.dto';
import { logger } from 'src/common/utils/logger';
import { Space, StatusSpace } from 'src/help-desk/schemas/space.schema';
import { MESSAGE_RESPONSE } from 'src/common/constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Space.name) private spaceModel: Model<Space>,
  ) {}
  async getProfile(id: string) {
    const user = await this.userModel
      .findById(id)
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
        ]),
      )
      .lean();
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    return user;
  }
  async find({ q, limit, type }: FindParams): Promise<User[]> {
    const users = await this.userModel
      .find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          {
            username: { $regex: q, $options: 'i' },
          },
          {
            ...(type === 'help-desk'
              ? { tempEmail: { $regex: q, $options: 'i' } }
              : { email: { $regex: q, $options: 'i' } }),
          },
        ],
        status:
          type === 'help-desk'
            ? { $in: [UserStatus.ANONYMOUS, UserStatus.ACTIVE] }
            : UserStatus.ACTIVE,
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
    return users.map((item) => ({
      ...item,
      email: type === 'help-desk' ? item.tempEmail : item.email,
    }));
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

  async setUpInfo(id: string, info: SetupInfoDto): Promise<User> {
    if (!info.avatar) {
      info.avatar = generateAvatar(info.name);
    }
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
  async findByBusiness({
    q,
    limit = 5,
    businessId,
    userId,
    currentPage = 1,
  }: FindParams & {
    businessId: string;
    userId: string;
  }): Promise<UserHelpDeskResponse> {
    const totalItemsPromise = this.userModel.countDocuments({
      business: new Types.ObjectId(businessId),
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        {
          tempEmail: { $regex: q, $options: 'i' },
        },
        {
          phoneNumber: { $regex: q, $options: 'i' },
        },
      ],
    });
    const query = [
      {
        $match: {
          business: new Types.ObjectId(businessId),
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } },
            {
              tempEmail: { $regex: q, $options: 'i' },
            },
            {
              phoneNumber: { $regex: q, $options: 'i' },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'rooms',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$$userId', '$participants'],
                },
                isHelpDesk: true,
                admin: new Types.ObjectId(userId),
              },
            },
          ],
          as: 'room',
        },
      },

      {
        $skip: (currentPage - 1) * limit,
      },
      {
        $limit: limit,
      },
      {
        $addFields: {
          room: { $arrayElemAt: ['$room', 0] },
        },
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
    const dataPromise = this.userModel.aggregate(query) as any;
    const [totalItems, data] = await Promise.all([
      totalItemsPromise,
      dataPromise,
    ]);

    return {
      totalPage: Math.ceil(totalItems / limit),
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
    const users = await this.userModel.find();
    for (const user of users) {
      if (!user.username) {
        const username = await this.generateUsernameByEmail(user.email);
        await this.userModel.findByIdAndUpdate(user._id, {
          username: username,
        });
      }
    }
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
}
