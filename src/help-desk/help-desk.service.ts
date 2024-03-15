import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generateSlug } from 'src/common/utils/generate-slug';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import {
  HelpDeskBusiness,
  Rating,
  StatusBusiness,
} from './schemas/help-desk-business.schema';
import { AnalystQueryDto, AnalystType } from './dto/analyst-query-dto';
import * as moment from 'moment';
import { AnalystResponseDto } from './dto/analyst-response-dto';
import { EditClientDto } from './dto/edit-client-dto';

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
  async analyst(params: AnalystQueryDto) {
    const { type, fromDate = '', toDate = '' } = params;
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

    const totalClients = await this.userModel.countDocuments({
      createdAt: {
        $gte: fromDateBy[type],
        $lte: toDateBy[type],
      },
    });

    const totalCompletedConversation =
      await this.roomsService.getTotalClientCompletedConversation(
        '65ee747a5fe03631e57731f3',
        fromDateBy[type],
        toDateBy[type],
      );

    const queryLastWeek = [
      {
        $match: {
          createdAt: {
            $gte: moment().subtract('7', 'd').toDate(),
            $lte: moment().toDate(),
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
            day: '$day',
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
    const queryLastMonth = [
      {
        $match: {
          createdAt: {
            $gte: moment().subtract('1', 'months').toDate(),
            $lte: moment().toDate(),
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
            day: '$day',
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

    const queryLastYear = [
      {
        $match: {
          createdAt: {
            $gte: moment().subtract('1', 'years').toDate(),
            $lte: moment().toDate(),
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
              { $toString: '$_id.month' },
              '-',
              { $toString: '$_id.year' },
            ],
          },
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

    const queryCustomDate = (fromDate: string, toDate: string) => {
      return [
        {
          $match: {
            createdAt: {
              $gte: moment(fromDate).toDate(),
              $lte: moment(toDate).toDate(),
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
              day: '$day',
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

    switch (type) {
      case AnalystType.LAST_WEEK:
        const dataLastWeek = await this.userModel.aggregate(queryLastWeek);
        const analytics = this.addMissingDates(
          dataLastWeek,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
            value: item.count,
          };
        });
        return {
          totalCompletedConversation,
          totalClients,
          analytics,
        };

      case AnalystType.LAST_MONTH:
        const dataLastMonth = await this.userModel.aggregate(queryLastMonth);
        return this.addMissingDates(
          dataLastMonth,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
      case AnalystType.LAST_YEAR:
        const dataLastYear = (
          await this.userModel.aggregate(queryLastYear)
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        return dataLastYear;

      case AnalystType.CUSTOM:
        const queryCustom = queryCustomDate(fromDate, toDate);
        const dataCustom = (await this.userModel.aggregate(queryCustom)).map(
          (item) => {
            return {
              label: item.date,
              value: item.count,
            };
          },
        );
        return dataCustom;
    }
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
}
