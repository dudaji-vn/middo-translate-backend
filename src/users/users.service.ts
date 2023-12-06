import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { SignUpDto } from 'src/auth/dto/sign-up.dto';
import { FindParams } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import { User, UserStatus } from './schemas/user.schema';
import { generateAvatar, selectPopulateField } from 'src/common/utils';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
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
        ]),
      )
      .lean();
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    return user;
  }
  async find({ q, limit }: FindParams): Promise<User[]> {
    const users = await this.userModel
      .find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { username: { $regex: q, $options: 'i' } },
        ],
        status: UserStatus.ACTIVE,
      })
      .limit(limit)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
      })
      .lean();
    return users;
  }
  async findById(id: ObjectId | string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    return user;
  }

  async findByEmail(
    email: string,
    options?: {
      notFoundMessage?: string;
      notFoundCode?: number;
      ignoreNotFound?: boolean;
    },
  ) {
    const user = await this.userModel.findOne({ email }).lean();
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

  async create(info: Partial<User>) {
    const user = await this.userModel.create(info);
    return user;
  }

  async isEmailExist(email: string) {
    return await this.userModel.exists({ email });
  }

  async update(id: ObjectId | string, info: Partial<User>) {
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
}
