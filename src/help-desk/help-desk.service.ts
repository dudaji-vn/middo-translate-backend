import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import {
  HelpDeskBusiness,
  StatusBusiness,
} from './schemas/help-desk-business.schema';

import { FindParams } from '../common/types';
import { generateSlug } from '../common/utils/generate-slug';
import { MessagesService } from '../messages/messages.service';
import { MessageType } from '../messages/schemas/messages.schema';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class HelpDeskService {
  constructor(
    @InjectModel(HelpDeskBusiness.name)
    private helpDeskBusinessModel: Model<HelpDeskBusiness>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private userService: UsersService,
    private roomsService: RoomsService,
    private messagesService: MessagesService,
  ) {}

  async createClient(businessId: string, info: Partial<User>) {
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
      status: UserStatus.ANONYMOUS,
      email: `${generateSlug()}@gmail.com`,
      business: business,
      name: info.name,
      isAnonymousClient: true,
      language: info.language,
      tempEmail: info.email,
    });

    const room = await this.roomsService.createHelpDeskRoom(
      {
        participants: [user._id, (business.user as User)._id],
        businessId: business._id.toString(),
        senderId: business.user.toString(),
      },
      business.user.toString(),
    );

    this.messagesService.initHelpDeskConversation(
      {
        clientTempId: '',
        content: business.firstMessage,
        contentEnglish: business.firstMessageEnglish,
        type: MessageType.TEXT,
        roomId: room._id.toString(),
        media: [],
      },
      business.user.toString(),
    );

    return {
      user: user,
      roomId: room._id.toString(),
    };
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
    return [];
  }

  async getBusinessByUser(userId: string) {
    return this.helpDeskBusinessModel
      .findOne({ user: userId, status: { $ne: StatusBusiness.DELETED } })
      .lean();
  }
  async getBusinessById(id: string) {
    return this.helpDeskBusinessModel
      .findOne({
        _id: id,
        status: { $ne: StatusBusiness.DELETED },
      })
      .lean();
  }
  async deleteBusiness(businessId: string, userId: string) {
    const business = await this.helpDeskBusinessModel
      .findById(businessId)
      .lean();
    if (!business) {
      throw new BadRequestException('business not found');
    }
    if (business.user.toString() !== userId) {
      throw new BadRequestException('you are not admin of business');
    }
    await this.helpDeskBusinessModel.updateOne(
      {
        _id: businessId,
      },
      {
        status: StatusBusiness.DELETED,
      },
    );
  }
}
