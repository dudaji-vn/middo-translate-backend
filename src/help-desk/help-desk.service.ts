import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { HelpDeskBusiness } from './schemas/help-desk-business.schema';
import { HelpDeskClient } from './schemas/help-desk-client.schema';
import { FindParams } from '../common/types';
import { selectPopulateField } from '../common/utils';

@Injectable()
export class HelpDeskService {
  constructor(
    @InjectModel(HelpDeskClient.name)
    private helpDeskClientModel: Model<HelpDeskClient>,
    @InjectModel(HelpDeskBusiness.name)
    private helpDeskBusinessModel: Model<HelpDeskBusiness>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private userService: UsersService,
  ) {}

  async createClient(businessId: string, info: Partial<HelpDeskClient>) {
    const { email = '' } = info;
    const isEmailExist = await this.userService.isEmailExist(email);
    if (isEmailExist) {
      throw new BadRequestException(
        'Email is exist. Please login with Middo account',
      );
    }
    const business = await this.helpDeskBusinessModel.findById(businessId);
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const user = await this.userModel.create({
      status: UserStatus.PENDING,
      email: `${new Date().getTime()}@gmail.com`,
    });
    info.user = user;
    info.business = business;
    const helpDeskClient = await this.helpDeskClientModel.create(info);
    return helpDeskClient;
  }

  async createOrEditBusiness(userId: string, info: Partial<HelpDeskBusiness>) {
    info.user = userId;
    const user = await this.helpDeskBusinessModel.findOneAndUpdate(
      {
        user: userId,
      },
      info,
      { new: true, upsert: true },
    );
    return user;
  }

  async findClient({ q, limit }: FindParams): Promise<Partial<User>[]> {
    const anonymousClient = await this.helpDeskClientModel
      .find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      })
      .populate({
        path: 'user',
      })

      .limit(limit)
      .select({
        name: true,
        avatar: true,
        email: true,
      })
      .lean();
    if (!anonymousClient) {
      return [];
    }
    return anonymousClient.map((item) => ({
      _id: item.user._id,
      avatar: item.avatar || '',
      email: item.email,
      name: item.name,
    }));
  }

  async getBusinessByUser(userId: string) {
    return this.helpDeskBusinessModel.findOne({ user: userId });
  }
  async getBusinessById(id: string) {
    return this.helpDeskBusinessModel.findById(id);
  }
}
