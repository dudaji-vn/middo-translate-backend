import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import {
  HelpDeskBusiness,
  Rating,
  StatusBusiness,
} from './schemas/help-desk-business.schema';

import { FindParams } from 'src/common/types';
import { generateSlug } from 'src/common/utils/generate-slug';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { CreateRatingDto } from './dto/create-rating.dto';

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
    // const { email = '' } = info;
    // const isEmailExist = await this.userService.isEmailExist(email);
    // if (isEmailExist) {
    //   throw new BadRequestException(
    //     'Email is exist. Please login with Middo account',
    //   );
    // }
    const business = await this.helpDeskBusinessModel.findById(businessId);

    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const user = await this.userModel.create({
      status: UserStatus.ANONYMOUS,
      email: `${generateSlug()}@gmail.com`,
      business: business,
      name: info.name,
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
        businessUserId: business.user.toString(),
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
  async rating(createRatingDto: CreateRatingDto) {
    const { userId, businessId, star } = createRatingDto;
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }
    const business = await this.helpDeskBusinessModel.findById(businessId);

    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const ratingIndex = business.ratings.findIndex(
      (item) => item.user.toString() === userId.toString(),
    );
    if (ratingIndex >= 0) {
      business.ratings[ratingIndex].star = star;
    } else {
      const rating: Rating = {
        user: user,
        star: star,
      } as Rating;
      business.ratings.push(rating);
    }

    await business.save();
    return true;
  }
}
