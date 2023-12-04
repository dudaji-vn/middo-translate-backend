import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { User, UserStatus } from './schemas/user.schema';
import { FindParams } from 'src/common/types';
import { SignUpDto } from 'src/auth/dtos/sign-up.dto';
import { SetupInfoDto } from './dtos/setup-info.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async getProfile(id: string) {
    const user = await this.userModel
      .findById(id)
      .select({
        name: true,
        username: true,
        avatar: true,
        email: true,
      })
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

  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email }).lean();
    if (!user) {
      throw new HttpException(`User ${email} not found`, 404);
    }
    return user;
  }

  async create(info: SignUpDto & { verifyToken: string }) {
    const user = await this.userModel.create({
      email: info.email,
      password: info.password,
      status: UserStatus.INACTIVE,
      verifyToken: info.verifyToken,
    });
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

  async setUpInfo(id: ObjectId, info: SetupInfoDto) {
    const user = await this.userModel.findByIdAndUpdate(id, info, {
      new: true,
    });
    if (!user) {
      throw new HttpException(`User ${id} not found`, 404);
    }
    return user;
  }
}
