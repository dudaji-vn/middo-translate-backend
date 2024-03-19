import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Model, ObjectId } from 'mongoose';
import { selectPopulateField } from 'src/common/utils';
import { generateSlug } from 'src/common/utils/generate-slug';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { AnalystQueryDto, AnalystType } from './dto/analyst-query-dto';
import { AnalystResponseDto } from './dto/analyst-response-dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { EditClientDto } from './dto/edit-client-dto';
import {
  HelpDeskBusiness,
  Rating,
  StatusBusiness,
} from './schemas/help-desk-business.schema';

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
    info.status = StatusBusiness.ACTIVE;
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
      .populate({
        path: 'user',
        select: selectPopulateField<User>(['name', 'avatar', 'language']),
      })
      .lean();
  }
  async deleteBusiness(userId: string) {
    const business = await this.helpDeskBusinessModel
      .findOne({ user: userId, status: { $ne: StatusBusiness.DELETED } })
      .lean();
    if (!business) {
      throw new BadRequestException('business not found');
    }
    if (business.user.toString() !== userId) {
      throw new BadRequestException('you are not admin of business');
    }
    await this.helpDeskBusinessModel.updateOne(
      {
        _id: business._id,
      },
      {
        status: StatusBusiness.DELETED,
      },
    );
    await this.roomsService.changeHelpDeskRoomStatusByUser(
      userId,
      RoomStatus.DELETED,
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
  async getClientsByUser(query: SearchQueryParamsDto, userId: string) {
    const { q, limit } = query;
    const business = await this.helpDeskBusinessModel.findOne({ user: userId });
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const data = await this.userService.findByBusiness({
      q,
      limit,
      businessId: business._id.toString(),
      userId: userId,
    });
    return data;
  }
  async editClientProfile(clientDto: EditClientDto, userId: string) {
    const { name, phoneNumber } = clientDto;
    const business = await this.helpDeskBusinessModel.findOne({ user: userId });
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const user = await this.userModel.findOne({
      _id: clientDto.userId,
      status: UserStatus.ANONYMOUS,
    });
    if (!user) {
      throw new BadRequestException('Client not found');
    }
    if (phoneNumber) {
      user.phoneNumber = phoneNumber;
    }
    if (name) {
      user.name = name;
    }
    await user.save();
    return true;
  }
  async analyst(params: AnalystQueryDto, userId: string) {
    const business = await this.helpDeskBusinessModel.findOne({ user: userId });
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const { type, fromDate, toDate } = params;
    const today = moment().toDate();
    const fromDateBy: Record<AnalystType, Date> = {
      [AnalystType.LAST_WEEK]: moment().subtract('7', 'd').toDate(),
      [AnalystType.LAST_MONTH]: moment().subtract('1', 'months').toDate(),
      [AnalystType.LAST_YEAR]: moment().subtract('1', 'years').toDate(),
      [AnalystType.CUSTOM]: moment(fromDate).toDate(),
    };
    const toDateBy: Record<AnalystType, Date> = {
      [AnalystType.LAST_WEEK]: today,
      [AnalystType.LAST_MONTH]: today,
      [AnalystType.LAST_YEAR]: today,
      [AnalystType.CUSTOM]: moment(toDate).toDate(),
    };

    const totalClientsWithTimePromise = this.userModel.countDocuments({
      business: business._id,
      createdAt: {
        $gte: fromDateBy[type],
        $lte: toDateBy[type],
      },
    });
    const totalClientsPromise = this.userModel.countDocuments({
      business: business._id,
    });

    const totalCompletedConversationWithTimePromise =
      this.roomsService.getTotalClientCompletedConversation(
        business.user.toString(),
        fromDateBy[type],
        toDateBy[type],
      );
    const totalCompletedConversationPromise =
      this.roomsService.getTotalClientCompletedConversation(
        business.user.toString(),
      );

    const averageRatingPromise = await this.getAverageRatingById(
      business._id,
      fromDateBy[type],
      toDateBy[type],
    );

    const [
      totalClientsWithTime,
      totalClients,
      totalCompletedConversationWithTime,
      totalCompletedConversation,
      averageRating,
    ] = await Promise.all([
      totalClientsWithTimePromise,
      totalClientsPromise,
      totalCompletedConversationWithTimePromise,
      totalCompletedConversationPromise,
      averageRatingPromise,
    ]);

    const queryCustomDate = (fromDate: Date, toDate: Date) => {
      return [
        {
          $match: {
            createdAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          },
        },
        {
          $project: {
            day: {
              $dayOfMonth: '$createdAt',
            },
            month: {
              $month: '$createdAt',
            },
            year: {
              $year: '$createdAt',
            },
          },
        },
        {
          $group: {
            _id: {
              ...(type !== AnalystType.LAST_YEAR && { day: '$day' }),
              year: '$year',
              month: '$month',
            },
            count: {
              $sum: 1,
            },
          },
        },

        {
          $project: {
            _id: 0,
            date: {
              $concat: [
                { $toString: '$_id.day' },
                '-',
                { $toString: '$_id.month' },
                '-',
                { $toString: '$_id.year' },
              ],
            },
            day: '$_id.day',
            month: '$_id.month',
            year: '$_id.year',
            count: '$count',
          },
        },
        {
          $sort: {
            day: 1,
          } as any,
        },
      ];
    };

    const queryDate = queryCustomDate(fromDateBy[type], toDateBy[type]);
    let analytics;
    switch (type) {
      case AnalystType.LAST_WEEK:
        const dataLastWeek = await this.userModel.aggregate(queryDate);
        analytics = this.addMissingDates(
          dataLastWeek,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
            value: item.count,
          };
        });
        break;

      case AnalystType.LAST_MONTH:
        const dataLastMonth = await this.userModel.aggregate(queryDate);
        analytics = this.addMissingDates(
          dataLastMonth,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        break;
      case AnalystType.LAST_YEAR:
        const dataLastYear = (await this.userModel.aggregate(queryDate)).map(
          (item) => {
            return {
              label: item.month,
              value: item.count,
            };
          },
        );
        analytics = dataLastYear;
        break;

      case AnalystType.CUSTOM:
        if (!fromDate || !toDate) {
          throw new BadRequestException('fromDate and toDate are required');
        }
        const queryCustom = queryCustomDate(fromDateBy[type], toDateBy[type]);
        const dataCustom = (await this.userModel.aggregate(queryCustom)).map(
          (item) => {
            return {
              label: item.date,
              value: item.count,
            };
          },
        );
        analytics = dataCustom;
        break;
    }

    return {
      client: {
        count: totalClientsWithTime,
        rate: Math.round((totalClientsWithTime * 100) / totalClients),
      },
      completedConversation: {
        count: totalCompletedConversationWithTime,
        rate: Math.round(
          (totalCompletedConversationWithTime * 100) /
            totalCompletedConversation,
        ),
      },
      averageRating: averageRating,
      responseChat: {
        averageTime: '1.5h',
        rate: 30,
      },
      chart: analytics,
    };
  }

  addMissingDates(
    data: AnalystResponseDto[],
    fromDate: Date,
    toDate: Date,
  ): AnalystResponseDto[] {
    // Convert existing dates to a Map for easy lookup
    const existingDates = new Map<string, AnalystResponseDto>();
    data.forEach((entry) => {
      existingDates.set(entry.date, entry);
    });

    // Get the start and end dates from the existing data
    const startDate = fromDate;
    const endDate = toDate;

    // Generate dates for the entire week
    const currentDate = new Date(startDate);
    const allDates: string[] = [];
    while (currentDate <= endDate) {
      const dateString = `${currentDate.getDate()}-${
        currentDate.getMonth() + 1
      }-${currentDate.getFullYear()}`;
      allDates.push(dateString);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add missing dates with count 0
    const newData: AnalystResponseDto[] = allDates.map((date) => {
      if (existingDates.has(date)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return existingDates.get(date)!;
      } else {
        const [day, month, year] = date.split('-').map(Number);
        return {
          date,
          day,
          month,
          year,
          count: 0,
        };
      }
    });

    return newData;
  }

  async getAverageRatingById(
    id: ObjectId,
    fromDate: Date,
    toDate: Date,
  ): Promise<number> {
    const result = await this.helpDeskBusinessModel.aggregate([
      {
        $match: {
          _id: id,
        },
      },
      {
        $unwind: '$ratings',
      },
      {
        $match: {
          'ratings.createdAt': { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$_id',
          averageRating: { $avg: '$ratings.star' },
        },
      },
    ]);

    return result.length > 0 ? result[0].averageRating : 0;
  }
}
