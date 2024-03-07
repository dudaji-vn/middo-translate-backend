import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { HelpDeskBusiness } from './schemas/help-desk-business.schema';
import { HelpDeskClient } from './schemas/help-desk-client.schema';

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
}
