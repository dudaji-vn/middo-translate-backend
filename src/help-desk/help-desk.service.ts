import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Model, ObjectId } from 'mongoose';
import { selectPopulateField } from 'src/common/utils';
import { generateSlug } from 'src/common/utils/generate-slug';
import { queryReportByType } from 'src/common/utils/query-report';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { AnalystQueryDto, AnalystType } from './dto/analyst-query-dto';
import { AnalystResponseDto } from './dto/analyst-response-dto';
import { ChartQueryDto, RatingQueryDto } from './dto/chart-query-dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { EditClientDto } from './dto/edit-client-dto';
import {
  HelpDeskBusiness,
  MemberStatus,
  Rating,
  StatusBusiness,
} from './schemas/help-desk-business.schema';

import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import {
  CreateOrEditSpaceDto,
  MemberDto,
} from './dto/create-or-edit-space-dto';
import { MailService } from '../mail/mail.service';
import { envConfig } from '../configs/env.config';
import { JwtService } from '@nestjs/jwt';
import { GetVerifyJwt } from '../common/decorators';
import { ValidateInviteStatus } from './dto/validate-invite-dto';

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
    private mailService: MailService,
    private jwtService: JwtService,
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

  async createOrEditBusiness(userId: string, info: CreateOrEditBusinessDto) {
    info.status = StatusBusiness.ACTIVE;
    if (info.chatFlow) {
      info.firstMessage = '';
      info.firstMessageEnglish = '';
    } else {
      info.chatFlow = null;
    }

    const user = await this.helpDeskBusinessModel.findOneAndUpdate(
      {
        user: userId,
      },
      info,
      { new: true, upsert: true },
    );
    return user;
  }

  async sendEmailToListMember(
    fullName: string,
    spaceName: string,
    members: MemberDto[],
  ) {
    for (const index in members) {
      const item = members[index];
      const token = `${generateSlug()}-${generateSlug()}`;

      const verifyUrl = await this.createVerifyUrl(token);
      await this.mailService.sendMail(
        item.email,
        `${fullName} has invited you to join the ${spaceName} space`,
        'verify-member',
        {
          title: `Join the ${spaceName} space`,
          verifyUrl: verifyUrl,
        },
      );
      members[index].verifyToken = token;
      members[index].invitedAt = new Date();
      members[index].status = MemberStatus.INVITED;
    }
    return members;
  }

  async createOrEditSpace(userId: string, space: CreateOrEditSpaceDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!space.members) {
      space.members = [];
    }
    space.members = space.members.filter((item) => item.email !== user.email);

    const spaceData = await this.helpDeskBusinessModel.findOne({
      user: userId,
    });

    if (!spaceData) {
      space.members = await this.sendEmailToListMember(
        user.name,
        space.name,
        space.members,
      );
    } else {
      let newMembers = space.members.filter(
        (item) => !spaceData.members.find((_) => _.email === item.email),
      );
      newMembers = await this.sendEmailToListMember(
        user.name,
        space.name,
        newMembers,
      );
      space.members = [...spaceData.members, ...newMembers];
    }

    const business = await this.helpDeskBusinessModel.findOneAndUpdate(
      {
        user: userId,
      },
      space,
      { new: true, upsert: true },
    );
    return business;
  }

  async getSpacesBy(userId: string, type: 'my-spaces' | 'joined-spaces') {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    let dataPromise;
    switch (type) {
      case 'my-spaces':
        dataPromise = this.helpDeskBusinessModel.find({
          user: userId,
        });
        break;
      case 'joined-spaces':
        dataPromise = this.helpDeskBusinessModel.find({
          members: {
            $elemMatch: {
              email: user.email,
              status: MemberStatus.JOINED,
            },
          },
        });
        break;
      default:
        dataPromise = this.helpDeskBusinessModel.find({
          $or: [
            {
              members: {
                $elemMatch: {
                  email: user.email,
                  status: MemberStatus.INVITED,
                },
              },
            },
            {
              user: userId,
            },
          ],
        });
    }
    return await dataPromise.select(
      'name avatar backgroundImage joinedAt createdAt',
    );
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
      throw new BadRequestException('Business not found');
    }
    if (business.user.toString() !== userId) {
      throw new BadRequestException('You are not admin of business');
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
    const { q, limit, currentPage } = query;
    const business = await this.helpDeskBusinessModel.findOne({ user: userId });
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const data = await this.userService.findByBusiness({
      q,
      limit,
      currentPage,
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
    const business = await this.getBusinessByUser(userId);
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

    const averageRatingPromise = this.getAverageRatingById(
      business._id,
      fromDateBy[type],
      toDateBy[type],
    );

    const averageResponseChatPromiseWithTimePromise =
      this.roomsService.getAverageResponseChat(
        business.user.toString(),
        fromDateBy[type],
        toDateBy[type],
      );

    const averageResponseChatPromise = this.roomsService.getAverageResponseChat(
      business.user.toString(),
    );
    const newClientsChartPromise = await this.getChartClient(
      business._id,
      type,
      fromDateBy[type],
      toDateBy[type],
    );
    const completedConversationsChartPromise =
      await this.roomsService.getChartCompletedConversation({
        type: type,
        userId: business.user.toString(),
        fromDate: fromDateBy[type],
        toDate: toDateBy[type],
      });
    const ratingsChartPromise = await this.getChartRating({
      businessId: business._id,
      type: type,
      fromDate: fromDateBy[type],
      toDate: toDateBy[type],
    });
    const responseChartPromise = await this.getChartAverageResponseChat({
      type: type,
      userId: business.user.toString(),
      fromDate: fromDateBy[type],
      toDate: toDateBy[type],
    });

    const [
      totalClientsWithTime,
      totalClients,
      totalCompletedConversationWithTime,
      totalCompletedConversation,
      averageRating,
      averageResponseChatWithTime,
      averageResponseChat,
    ] = await Promise.all([
      totalClientsWithTimePromise,
      totalClientsPromise,
      totalCompletedConversationWithTimePromise,
      totalCompletedConversationPromise,
      averageRatingPromise,
      averageResponseChatPromiseWithTimePromise,
      averageResponseChatPromise,
    ]);

    let [
      newClientsChart,
      completedConversationsChart,
      ratingsChart,
      responseChart,
    ] = await Promise.all([
      newClientsChartPromise,
      completedConversationsChartPromise,
      ratingsChartPromise,
      responseChartPromise,
    ]);

    switch (type) {
      case AnalystType.LAST_WEEK:
        newClientsChart = this.addMissingDates(
          newClientsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
            value: item.count,
          };
        });
        completedConversationsChart = this.addMissingDates(
          completedConversationsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
            value: item.count,
          };
        });
        ratingsChart = this.addMissingDates(
          ratingsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
            value: item.count,
          };
        });
        responseChart = this.addMissingDates(
          responseChart,
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
        newClientsChart = this.addMissingDates(
          newClientsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        completedConversationsChart = this.addMissingDates(
          completedConversationsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        ratingsChart = this.addMissingDates(
          ratingsChart,
          fromDateBy[type],
          toDateBy[type],
        ).map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        responseChart = this.addMissingDates(
          responseChart,
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
        newClientsChart = this.addMissingMonths(newClientsChart).map((item) => {
          return {
            label: `01-${item.month}-${item.year}`,
            value: item.count,
          };
        });
        completedConversationsChart = this.addMissingMonths(
          completedConversationsChart,
        ).map((item) => {
          return {
            label: `01-${item.month}-${item.year}`,
            value: item.count,
          };
        });
        ratingsChart = this.addMissingMonths(ratingsChart).map((item) => {
          return {
            label: `01-${item.month}-${item.year}`,
            value: item.count,
          };
        });
        responseChart = this.addMissingMonths(responseChart).map((item) => {
          return {
            label: `01-${item.month}-${item.year}`,
            value: item.count,
          };
        });
        break;

      case AnalystType.CUSTOM:
        if (!fromDate || !toDate) {
          throw new BadRequestException('fromDate and toDate are required');
        }

        newClientsChart = newClientsChart.map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        completedConversationsChart = completedConversationsChart.map(
          (item) => {
            return {
              label: item.date,
              value: item.count,
            };
          },
        );
        ratingsChart = ratingsChart.map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });
        responseChart = responseChart.map((item) => {
          return {
            label: item.date,
            value: item.count,
          };
        });

        break;
    }

    const averageChatDurationWithTime =
      averageResponseChatWithTime[0]?.averageDifference || 0;
    const averageChatDuration = averageResponseChat[0].averageDifference;
    return {
      client: {
        count: totalClientsWithTime,
        rate:
          totalClients === 0
            ? 0
            : Math.round((totalClientsWithTime * 100) / totalClients),
      },
      completedConversation: {
        count: totalCompletedConversationWithTime,
        rate:
          totalCompletedConversation === 0
            ? 0
            : Math.round(
                (totalCompletedConversationWithTime * 100) /
                  totalCompletedConversation,
              ),
      },
      averageRating: {
        count: averageRating.count,
        rate: averageRating.rate,
      },
      responseChat: {
        averageTime: averageChatDurationWithTime,
        rate:
          averageChatDuration === 0
            ? 0
            : Math.round(
                ((averageChatDuration - averageChatDurationWithTime) * 100) /
                  averageChatDuration,
              ),
      },
      chart: {
        client: newClientsChart,
        completedConversation: completedConversationsChart,
        averageRating: ratingsChart,
        responseChat: responseChart,
      },
    };
  }

  async acceptInvite(token: string, status: ValidateInviteStatus) {
    const space = await this.helpDeskBusinessModel.findOne({
      members: {
        $elemMatch: {
          verifyToken: token,
        },
      },
    });

    if (!space) {
      throw new BadRequestException('Token is invalid');
    }

    const memberIndex = space.members.findIndex(
      (item) => item.verifyToken === token,
    );
    if (space.members[memberIndex].status === MemberStatus.JOINED) {
      throw new BadRequestException('You are joined this space');
    }
    if (
      status === ValidateInviteStatus.DECLINE &&
      space.members[memberIndex].status === MemberStatus.INVITED
    ) {
      space.members = space.members.filter(
        (item) => item.verifyToken !== token,
      );
    } else {
      space.members[memberIndex].status = MemberStatus.JOINED;
      space.members[memberIndex].joinedAt = new Date();
    }

    await space.save();
    return true;
  }

  async getMyInvitations(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const myInvitations = await this.helpDeskBusinessModel
      .find({
        members: {
          $elemMatch: {
            email: user.email,
            status: MemberStatus.INVITED,
          },
        },
      })
      .populate('user', 'name avatar members')
      .select('name user members')
      .lean();
    return myInvitations.map((item) => {
      console.log(item);
      const invitedAt = item.members.find(
        (item) => item.email === user.email,
      )?.invitedAt;

      return {
        ...item,
        invitedAt: invitedAt,
      };
    });
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
  addMissingMonths(data: AnalystResponseDto[]) {
    // Get the current month and year
    const currentDate: Date = new Date();
    const currentMonth: number = currentDate.getMonth();
    const currentYear: number = currentDate.getFullYear();

    // Calculate the start month and year
    let startMonth: number = (currentMonth + 1) % 12; // Last month of last year
    const startYear: number = currentYear - 1;
    if (startMonth === 0) {
      startMonth = 12;
    }

    // Create a list of months from the start month and year to the current month and year
    const months = [];
    for (let year = startYear; year <= currentYear; year++) {
      for (
        let month = year === startYear ? startMonth : 1;
        month <= (year === currentYear ? currentMonth + 1 : 12);
        month++
      ) {
        months.push({ count: 0, month, year });
      }
    }

    // Iterate through each month and add it to the data if it doesn't exist
    months.forEach(({ month, year }) => {
      const monthExists: boolean = data.some(
        (item) => item.month === month && item.year === year,
      );
      if (!monthExists) {
        data.push({
          count: 0,
          month,
          year,
          date: '',
          day: 1,
        });
      }
    });

    // Sort the data by year and month
    data.sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });

    return data;
  }

  async getAverageRatingById(
    businessId: ObjectId,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    count: number;
    rate: string;
  }> {
    const result = await this.helpDeskBusinessModel.aggregate([
      {
        $match: {
          _id: businessId,
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
          numberPeopleRating: { $sum: 1 },
        },
      },
    ]);

    return result.length > 0 && result[0]
      ? {
          count: result[0].averageRating
            ? result[0].averageRating.toFixed(1)
            : 0,
          rate:
            result[0].numberPeopleRating && result[0].averageRating
              ? `${result[0].averageRating.toFixed(1)}/${
                  result[0].numberPeopleRating
                }`
              : '0/0',
        }
      : {
          count: 0,
          rate: '0/0',
        };
  }

  async getChartRating(payload: RatingQueryDto) {
    const { businessId, fromDate, toDate, type } = payload;
    const pipeRating = [
      {
        $match: {
          _id: businessId,
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
        $project: {
          day: {
            $dayOfMonth: '$ratings.createdAt',
          },
          month: {
            $month: '$ratings.createdAt',
          },
          year: {
            $year: '$ratings.createdAt',
          },
          star: '$ratings.star',
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
            $avg: '$star',
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

    return this.helpDeskBusinessModel.aggregate(pipeRating);
  }

  async getChartClient(
    businessId: ObjectId,
    type: AnalystType,
    fromDate: Date,
    toDate: Date,
  ) {
    const queryByBusiness = [
      {
        $match: {
          business: businessId,
          createdAt: {
            $gte: fromDate,
            $lte: toDate,
          },
        },
      },
    ];
    const queryDate = queryReportByType(type, queryByBusiness);
    return await this.userModel.aggregate(queryDate);
  }
  async getResponseChat() {
    return [];
  }
  async getChartAverageResponseChat(payload: ChartQueryDto) {
    return this.roomsService.getChartAverageResponseChat(payload);
  }

  createVerifyUrl(token: string) {
    return `${envConfig.app.url}/space-verify?token=${token}`;
  }

  async createVerifyToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: envConfig.jwt.verifyToken.secret,
      expiresIn: envConfig.jwt.verifyToken.expiresIn,
    });
  }
}
