import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import mongoose, { Model, ObjectId, Types } from 'mongoose';
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
  ROLE,
  Rating,
  StatusBusiness,
} from './schemas/help-desk-business.schema';

import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import {
  CreateOrEditTagDto,
  CreateOrEditSpaceDto,
  InviteMemberDto,
  MemberDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/create-or-edit-space-dto';
import { MailService } from 'src/mail/mail.service';
import { envConfig } from 'src/configs/env.config';
import { ValidateInviteStatus } from './dto/validate-invite-dto';
import { Member, Space, StatusSpace } from './schemas/space.schema';
import { SpaceNotification } from './schemas/space-notifications.schema';

@Injectable()
export class HelpDeskService {
  constructor(
    @InjectModel(HelpDeskBusiness.name)
    private helpDeskBusinessModel: Model<HelpDeskBusiness>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Space.name)
    private spaceModel: Model<Space>,
    @InjectModel(SpaceNotification.name)
    private spaceNotificationModel: Model<SpaceNotification>,
    private userService: UsersService,
    private roomsService: RoomsService,
    private messagesService: MessagesService,
    private mailService: MailService,
  ) {}

  async createClient(businessId: string, info: Partial<User>) {
    const business = await this.helpDeskBusinessModel
      .findById(businessId)
      .populate('space');

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

    const participants: any = business.space.members
      .filter((item) => item.status === MemberStatus.JOINED && item.user)
      .map((item) => item.user);
    if (!participants) {
      return new BadRequestException('Not participant in this room');
    }

    const room = await this.roomsService.createHelpDeskRoom(
      {
        participants: [user._id, ...participants],
        businessId: business._id.toString(),
        senderId: business.user.toString(),
        space: business.space._id,
      },
      business.user.toString(),
    );

    if (
      !business.chatFlow &&
      business.firstMessage &&
      business.firstMessageEnglish
    ) {
      await this.messagesService.initHelpDeskConversation(
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
    }

    return {
      user: user,
      roomId: room._id.toString(),
    };
  }

  async createOrEditExtension(userId: string, info: CreateOrEditBusinessDto) {
    const space = await this.spaceModel.findOne({
      _id: info.spaceId,
      status: { $ne: StatusSpace.DELETED },
    });
    if (!space) {
      throw new BadRequestException('Space not found');
    }

    info.status = StatusBusiness.ACTIVE;
    if (info.chatFlow) {
      info.firstMessage = '';
      info.firstMessageEnglish = '';
    } else {
      info.chatFlow = null;
    }
    info.space = info.spaceId;
    if (userId.toString() !== space.owner.toString()) {
      throw new ForbiddenException(
        'You do not have permission to create or edit extensions',
      );
    }
    info.user = userId;
    const extension = await this.helpDeskBusinessModel.findOneAndUpdate(
      {
        space: info.spaceId,
      },
      info,
      { new: true, upsert: true },
    );
    return extension;
  }

  async createOrEditSpace(userId: string, space: CreateOrEditSpaceDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!space.spaceId) {
      const me = {
        email: user.email,
        role: ROLE.ADMIN,
        verifyToken: '',
        status: MemberStatus.JOINED,
        joinedAt: new Date(),
        user: userId,
      };
      if (!space.members) {
        space.members = [];
      }
      space.members = space.members.filter((item) => item.email !== me.email);

      const members = space.members.map((item) => {
        const token = `${generateSlug()}-${generateSlug()}`;
        return {
          email: item.email,
          role: item.role,
          verifyToken: token,
          invitedAt: new Date(),
          expiredAt: moment().add('7', 'day').toDate(),
          status: MemberStatus.INVITED,
          verifyUrl: this.createVerifyUrl(token),
        };
      });

      const bot = await this.userModel.create({
        status: UserStatus.BOT,
        email: `${generateSlug()}@gmail.com`,
        name: space.name,
        language: user.language,
        avatar: space.avatar,
      });

      const spaceData = await this.spaceModel.create({
        owner: user._id,
        avatar: space.avatar,
        backgroundImage: space.backgroundImage,
        members: [me, ...members],
        name: space.name,
        bot: bot,
      });

      await members.forEach((data) => {
        this.spaceNotificationModel.create({
          space: spaceData._id,
          description: `You've been invited to join ${spaceData.name}`,
          from: user,
          to: data.email,
          link: data.verifyUrl,
        });
        this.mailService.sendMail(
          data.email,
          `${user.name} has invited you to join the ${spaceData.name} space`,
          'verify-member',
          {
            title: `Join the ${spaceData.name} space`,
            verifyUrl: data.verifyUrl,
          },
        );
      });

      return spaceData;
    } else {
      const spaceData = await this.spaceModel.findOne({
        _id: space.spaceId,
        status: { $ne: StatusSpace.DELETED },
      });
      if (!spaceData) {
        throw new BadRequestException('Space not found');
      }
      if (!this.isAdminSpace(spaceData.members, userId)) {
        throw new ForbiddenException(
          'You do not have permission to edit space',
        );
      }
      if (space.avatar) {
        spaceData.avatar = space.avatar;
      }
      if (space.backgroundImage) {
        spaceData.backgroundImage = space.backgroundImage;
      }
      if (space.name) {
        spaceData.name = space.name;
      }
      if (spaceData.bot) {
        await this.userModel.findByIdAndUpdate(spaceData.bot, {
          avatar: space.avatar,
        });
      }
      await spaceData.save();
      return spaceData;
    }
  }

  async getSpacesBy(
    userId: string,
    type: 'all_spaces' | 'my_spaces' | 'joined_spaces',
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    let dataPromise;
    switch (type) {
      case 'my_spaces':
        dataPromise = this.spaceModel.find({
          owner: userId,
          status: { $ne: StatusSpace.DELETED },
        });

        break;
      case 'joined_spaces':
        dataPromise = this.spaceModel.find({
          owner: { $ne: user._id },
          status: { $ne: StatusSpace.DELETED },
          members: {
            $elemMatch: {
              email: user.email,
              status: MemberStatus.JOINED,
            },
          },
        });
        break;
      default:
        dataPromise = this.spaceModel.find({
          status: { $ne: StatusSpace.DELETED },
          $or: [
            {
              members: {
                $elemMatch: {
                  email: user.email,
                  status: MemberStatus.JOINED,
                },
              },
            },
            {
              owner: userId,
            },
          ],
        });
    }
    const data = await dataPromise
      .populate('owner', 'email')
      .select(
        'name avatar backgroundImage joinedAt createdAt members.email members.joinedAt members.status',
      )
      .lean();

    return data.map((item) => {
      const members = item.members.filter(
        (user) => user.status === MemberStatus.JOINED,
      );
      const joinedAt = item.members.find(
        (item) => item.email === user.email,
      )?.joinedAt;
      return {
        ...item,
        members: members,
        joinedAt: joinedAt,
        totalNewMessages: 3,
        totalMembers: members.length,
      };
    });
  }
  async getSpaceById(userId: string, spaceId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const space = await this.spaceModel
      .findOne({
        _id: spaceId,
        status: { $ne: StatusSpace.DELETED },
        $or: [
          {
            'members.email': user.email,
          },
        ],
      })
      .populate('owner', 'email')
      .select('-members.verifyToken')
      .lean();
    if (!space) {
      throw new BadRequestException('Space not found');
    }
    const isAccess = space.members.find(
      (item) =>
        item.email === user.email && item.status === MemberStatus.JOINED,
    );
    if (!isAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this space',
      );
    }
    const extension = await this.helpDeskBusinessModel
      .findOne({
        space: new Types.ObjectId(spaceId),
        status: { $ne: StatusBusiness.DELETED },
      })
      .select('-space')
      .lean();
    space.members = space.members.filter(
      (user) => user.status !== MemberStatus.DELETED,
    );
    space.tags = space.tags.filter((tag) => !tag.isDeleted);
    return {
      ...space,
      extension: extension,
    };
  }

  async getBusinessByUser(userId: string, spaceId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isAdminOrMember = await this.spaceModel.findOne({
      _id: new mongoose.Types.ObjectId(spaceId),
      status: { $ne: StatusSpace.DELETED },
      $or: [
        {
          'members.email': user.email,
        },
      ],
    });
    if (!isAdminOrMember) {
      throw new ForbiddenException('You do not have access to this space!');
    }
    return this.helpDeskBusinessModel
      .findOne({
        space: new Types.ObjectId(spaceId),
        status: { $ne: StatusBusiness.DELETED },
      })
      .populate('space', '-members.verifyToken')
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
      .populate('space', '-members.verifyToken')
      .lean();
  }
  async deleteExtension(userId: string, extensionId: string) {
    const business = await this.helpDeskBusinessModel
      .findOne({ _id: extensionId, status: { $ne: StatusBusiness.DELETED } })
      .lean();
    if (!business) {
      throw new BadRequestException('Business not found');
    }
    if (business.user.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete extension',
      );
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
      business.space.toString(),
      RoomStatus.DELETED,
    );
  }
  async deleteSpace(spaceId: string, userId: string) {
    const space = await this.spaceModel.findOne({
      _id: spaceId,
      status: { $ne: StatusSpace.DELETED },
    });

    if (!space) {
      throw new BadRequestException('Space not found');
    }
    if (space?.owner.toString() !== userId.toString()) {
      throw new ForbiddenException(
        'You do not have permission to delete space',
      );
    }

    space.status = StatusSpace.DELETED;
    await space.save();
    const extension = await this.helpDeskBusinessModel.findOne({
      space: spaceId,
    });
    if (extension) {
      extension.status = StatusBusiness.DELETED;
      await extension.save();
    }

    return true;
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
    const business = await this.helpDeskBusinessModel.findOne({
      space: query.spaceId,
    });
    if (!business) {
      throw new BadRequestException('space not found');
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
    const space = await this.spaceModel.findOne({
      _id: clientDto.spaceId,
      status: { $ne: StatusSpace.DELETED },
      members: {
        $elemMatch: {
          user: new mongoose.Types.ObjectId(userId),
        },
      },
    });
    if (!space) {
      throw new ForbiddenException(
        'You do not have permission to edit profile',
      );
    }
    const business = await this.helpDeskBusinessModel.findOne({
      space: clientDto.spaceId,
    });
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
    const spaceId = params.spaceId;
    const business = await this.getBusinessByUser(userId, spaceId);
    if (!business) {
      throw new BadRequestException('You have not created an extension yet');
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
        spaceId,
        fromDateBy[type],
        toDateBy[type],
      );
    const totalCompletedConversationPromise =
      this.roomsService.getTotalClientCompletedConversation(spaceId);

    const averageRatingPromise = this.getAverageRatingById(
      business._id,
      fromDateBy[type],
      toDateBy[type],
    );

    const averageResponseChatPromiseWithTimePromise =
      this.roomsService.getAverageResponseChat(
        spaceId,
        fromDateBy[type],
        toDateBy[type],
      );

    const averageResponseChatPromise =
      this.roomsService.getAverageResponseChat(spaceId);
    const newClientsChartPromise = await this.getChartClient(
      business._id,
      type,
      fromDateBy[type],
      toDateBy[type],
    );
    const completedConversationsChartPromise =
      await this.roomsService.getChartCompletedConversation({
        type: type,
        spaceId: business.space._id.toString(),
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
      spaceId: business.space?._id.toString(),
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

  async validateInvite(
    userId: string,
    token: string,
    status: ValidateInviteStatus,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const space = await this.spaceModel.findOne({
      members: {
        $elemMatch: {
          verifyToken: token,
        },
      },
    });

    if (!space) {
      throw new BadRequestException('Token is invalid');
    }
    if (space.status === StatusSpace.DELETED) {
      throw new BadRequestException('This space is deleted');
    }

    const memberIndex = space.members.findIndex(
      (item) => item.verifyToken === token,
    );
    const email = space.members[memberIndex].email;
    if (email !== user.email) {
      throw new ForbiddenException(
        'You do not have permission to view this invitaion',
      );
    }
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
      await space.save();
    } else {
      space.members[memberIndex].status = MemberStatus.JOINED;
      space.members[memberIndex].joinedAt = new Date();
      space.members[memberIndex].user = userId;
      await space.save();
      this.roomsService.addHelpDeskParticipant(
        space._id.toString(),
        space.owner.toString(),
        userId,
      );
    }

    return true;
  }

  async getMyInvitations(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const myInvitations = await this.spaceModel
      .find({
        members: {
          $elemMatch: {
            email: user.email,
            status: MemberStatus.INVITED,
          },
        },
      })
      .populate('owner', 'email')
      .select('name avatar backgroundImage members owner')
      .lean();
    return myInvitations.map((item) => {
      const memberInfo = item.members.find((item) => item.email === user.email);
      const invitedAt = memberInfo?.invitedAt;

      return {
        space: {
          _id: item._id,
          avatar: item.avatar,
          backgroundImage: item.backgroundImage,
          name: item.name,
          owner: item.owner,
        },
        email: user.email,
        verifyToken: memberInfo?.verifyToken,
        invitedAt: invitedAt,
        isExpired: moment().isAfter(memberInfo?.expiredAt),
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

  async inviteMembers(userId: string, data: InviteMemberDto) {
    const user = await this.userService.findById(userId);
    const spaceData = await this.spaceModel.findOne({
      _id: data.spaceId,
      status: { $ne: StatusSpace.DELETED },
    });

    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }

    if (!this.isAdminSpace(spaceData.members, user._id.toString())) {
      throw new ForbiddenException(
        'You do not have permission to invite members to the group',
      );
    }

    data.members.forEach((member) => {
      const user = spaceData.members.find(
        (item) => item.email === member.email,
      );
      if (user?.status === MemberStatus.INVITED) {
        throw new BadRequestException(`Email ${user.email} already invited!`);
      }
      if (user?.status === MemberStatus.JOINED) {
        throw new BadRequestException(`Email ${user.email} already joined!`);
      }
    });

    const newMembers = data.members.map((item) => {
      const token = `${generateSlug()}-${generateSlug()}`;
      return {
        email: item.email,
        role: item.role,
        verifyToken: token,
        invitedAt: new Date(),
        expiredAt: moment().add('7', 'day').toDate(),
        status: MemberStatus.INVITED,
        verifyUrl: this.createVerifyUrl(token),
      };
    });

    spaceData.members.push(...(newMembers as any));
    await spaceData.save();
    newMembers.forEach((data) => {
      this.spaceNotificationModel.create({
        space: spaceData._id,
        description: `You've been invited to join ${spaceData.name}`,
        from: user,
        to: data.email,
        link: data.verifyUrl,
      });
      this.mailService.sendMail(
        data.email,
        `${user.name} has invited you to join the ${spaceData.name} space`,
        'verify-member',
        {
          title: `Join the ${spaceData.name} space`,
          verifyUrl: data.verifyUrl,
        },
      );
    });

    return spaceData.members.map((item) => {
      return {
        email: item.email,
        role: item.role,
        status: item.status,
        verifyToken: item.verifyToken,
        invitedAt: item.invitedAt,
        expiredAt: item.expiredAt,
      };
    });
  }
  async resendInvitation(userId: string, data: UpdateMemberDto) {
    const spaceData = await this.spaceModel.findOne({
      status: { $ne: StatusSpace.DELETED },
      _id: data.spaceId,
    });

    const user = await this.userService.findById(userId);
    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }
    if (!this.isAdminSpace(spaceData.members, userId)) {
      throw new ForbiddenException(
        'You do not have permission to resend invitation',
      );
    }

    const index = spaceData.members.findIndex(
      (item) => item.email === data.email,
    );
    if (index === -1) {
      throw new BadRequestException('User are not invite');
    }

    const token = `${generateSlug()}-${generateSlug()}`;

    const verifyUrl = await this.createVerifyUrl(token);
    await this.spaceNotificationModel.create({
      space: spaceData._id,
      description: `You've been invited to join ${spaceData.name}`,
      from: user,
      to: data.email,
      link: verifyUrl,
    });
    await this.mailService.sendMail(
      data.email,
      `${user.name} has invited you to join the ${spaceData.name} space`,
      'verify-member',
      {
        title: `Join the ${spaceData.name} space`,
        verifyUrl: verifyUrl,
      },
    );
    spaceData.members[index] = {
      email: data.email,
      role: data.role,
      verifyToken: token,
      invitedAt: new Date(),
      status: MemberStatus.INVITED,
      expiredAt: moment().add('7', 'day').toDate(),
    };

    await spaceData.save();
    return true;
  }
  async removeMember(userId: string, data: RemoveMemberDto) {
    const spaceData = await this.spaceModel.findOne({
      _id: data.spaceId,
      status: { $ne: StatusSpace.DELETED },
    });

    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }
    if (spaceData.owner.toString() !== userId.toString()) {
      throw new ForbiddenException(
        'You do not have permission to remove member',
      );
    }

    const index = spaceData.members.findIndex(
      (item) => item.email === data.email,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in space');
    }

    spaceData.members[index].status = MemberStatus.DELETED;

    await spaceData.save();
    return true;
  }
  async changeRole(userId: string, data: UpdateMemberDto) {
    const spaceData = await this.spaceModel.findOne({
      status: { $ne: StatusSpace.DELETED },
      _id: data.spaceId,
    });

    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }
    if (!this.isAdminSpace(spaceData.members, userId)) {
      throw new ForbiddenException('You do not have permission to change role');
    }

    const index = spaceData.members.findIndex(
      (item) => item.email === data.email,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in space');
    }

    spaceData.members[index].role = data.role;

    await spaceData.save();
    return true;
  }

  async createOrEditTag(userId: string, tagDto: CreateOrEditTagDto) {
    const { spaceId, name, color, tagId } = tagDto;
    const space = await this.spaceModel
      .findOne({
        _id: spaceId,
        status: { $ne: StatusSpace.DELETED },
      })
      .populate('tags');
    if (!space) {
      throw new BadRequestException('Space not found');
    }

    if (!this.isAdminSpace(space.members, userId)) {
      throw new ForbiddenException(
        'You do not have permission to create or edit tag',
      );
    }
    const item: any = {
      color: color,
      name: name,
    };
    if (!tagId) {
      space.tags = space.tags || [];
      if (space.tags.find((item) => item.name === name && !item.isDeleted)) {
        throw new BadRequestException('name already exists');
      }
      space.tags.push(item);
    } else {
      const index = space.tags.findIndex(
        (item) => item._id.toString() === tagId,
      );
      if (index === -1) {
        throw new BadRequestException('Tag not found');
      }
      if (space.tags[index].isReadonly) {
        throw new BadRequestException('This tag is readonly');
      }
      space.tags[index].name = name;
      space.tags[index].color = color;
    }
    await space.save();
    return space.tags;
  }

  async addMissingData() {
    await this.spaceModel.updateMany(
      { tags: { $exists: false } },
      {
        $set: {
          tags: [
            { name: 'pending', color: '#FF3333', isReadonly: true },
            { name: 'completed', color: '#00B512', isReadonly: true },
          ],
        },
      },
    );
    const spaces = await this.spaceModel.find().populate('owner');

    for (const space of spaces) {
      if (!space.bot) {
        const bot = await this.userModel.create({
          status: UserStatus.BOT,
          email: `${generateSlug()}@gmail.com`,
          name: space.name,
          language: (space.owner as User).language,
          avatar: space.avatar,
        });
        space.bot = bot;
      }

      await space.save();
    }
    return spaces;
  }

  async deleteTag(tagId: string, spaceId: string, userId: string) {
    const space = await this.spaceModel.findById(spaceId);
    if (!space) {
      throw new BadRequestException('Space not found');
    }

    if (!this.isAdminSpace(space.members, userId)) {
      throw new ForbiddenException(
        'You do not have permission to delete the tag',
      );
    }

    const indexTag = space.tags.findIndex(
      (item) => item._id.toString() === tagId.toString(),
    );

    if (indexTag === -1 || space.tags[indexTag].isDeleted) {
      throw new BadRequestException('Tag not found');
    }
    if (space.tags[indexTag].isReadonly) {
      throw new BadRequestException('This tag is read only');
    }
    space.tags[indexTag].isDeleted = true;

    await space.save();
    return true;
  }
  async getNotifications(userId: string) {
    const user = await this.userService.findById(userId);
    const notifications = this.spaceNotificationModel
      .find({
        to: user.email,
        isDeleted: { $ne: true },
      })
      .populate('from', 'name avatar')
      .select('-to');
    return notifications;
  }
  async readNotification(id: string) {
    const notification = await this.spaceNotificationModel.findById(id);
    if (!notification) {
      throw new BadRequestException('id not exist');
    }
    notification.unRead = false;
    await notification.save();
    return notification;
  }
  async deleteNotification(id: string, userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const notification = await this.spaceNotificationModel.findById(id);
    if (!notification) {
      throw new BadRequestException('Notification not found');
    }
    if (user.email !== notification.to) {
      throw new BadRequestException(
        'You do not have permission to delete notifications',
      );
    }
    notification.isDeleted = true;
    await notification.save();
    return null;
  }
  isAdminSpace(members: Member[], userId: string) {
    return members.find(
      (member) =>
        member.user?.toString() === userId &&
        member.role === ROLE.ADMIN &&
        member.status === MemberStatus.JOINED,
    );
  }
}
