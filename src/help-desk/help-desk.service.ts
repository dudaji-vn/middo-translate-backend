import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import mongoose, { Model, ObjectId, Types } from 'mongoose';
import { selectPopulateField } from 'src/common/utils';
import { generateSlug } from 'src/common/utils/generate-slug';
import { queryReportByType } from 'src/common/utils/query-report';
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

import { EventEmitter2 } from '@nestjs/event-emitter';
import { envConfig } from 'src/configs/env.config';
import { socketConfig } from 'src/configs/socket.config';
import { MailService } from 'src/mail/mail.service';
import { MessagesService } from 'src/messages/messages.service';
import { CreateOrEditBusinessDto as CreateOrEditExtensionDto } from './dto/create-or-edit-business-dto';
import {
  CreateOrEditSpaceDto,
  CreateOrEditTagDto,
  InviteMemberDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/create-or-edit-space-dto';
import { ValidateInviteStatus } from './dto/validate-invite-dto';
import { SpaceNotification } from './schemas/space-notifications.schema';
import { Member, Script, Space, StatusSpace } from './schemas/space.schema';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditScriptDto } from './dto/create-or-edit-script-dto';
import { ChatFlow } from './schemas/chat-flow.schema';

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
    @InjectModel(Script.name)
    private scriptModel: Model<Script>,
    private userService: UsersService,
    private roomsService: RoomsService,
    private messagesService: MessagesService,
    private mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createClient(businessId: string, info: CreateClientDto) {
    const slug = generateSlug();
    const business = await this.helpDeskBusinessModel
      .findById(businessId)
      .populate('space');

    if (!business) {
      throw new BadRequestException('Business not found');
    }
    const user = await this.userModel.create({
      status: UserStatus.ANONYMOUS,
      email: `${slug}@gmail.com`,
      username: slug,
      business: business,
      name: info.name,
      language: info.language,
      tempEmail: info.email,
      space: business.space._id,
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
        fromDomain: info.fromDomain,
      },
      business.user.toString(),
    );

    if (
      !business.currentScript &&
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

  async createOrEditExtension(
    spaceId: string,
    userId: string,
    info: CreateOrEditExtensionDto,
  ) {
    const space = await this.spaceModel.findOne({
      _id: spaceId,
      status: { $ne: StatusSpace.DELETED },
    });
    if (!space) {
      throw new BadRequestException('Space not found');
    }
    if (!this.isAdminSpace(space.members, userId)) {
      throw new ForbiddenException(
        'You do not have permission to create or edit extensions',
      );
    }
    info.status = StatusBusiness.ACTIVE;
    info.space = spaceId;
    info.user = userId;

    if (info.currentScript) {
      const script = await this.scriptModel.find({
        _id: info.currentScript,
        isDeleted: { $ne: true },
      });
      if (!script) {
        throw new BadRequestException(
          `Script ${info.currentScript} not exist in this space`,
        );
      }
      info.firstMessage = '';
      info.firstMessageEnglish = '';
    } else {
      info.currentScript = null;
    }

    const extension = await this.helpDeskBusinessModel.findOneAndUpdate(
      {
        space: spaceId,
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
      const uniqueEmails = new Set();
      space.members = space.members
        .filter((item) => item.email !== me.email)
        .filter((member) => {
          if (!uniqueEmails.has(member.email)) {
            uniqueEmails.add(member.email);
            return true;
          }

          return false;
        });

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
      const slug = generateSlug();
      const bot = await this.userModel.create({
        status: UserStatus.BOT,
        email: `${slug}@gmail.com`,
        username: slug,
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

      // get all userId from members

      await members.forEach((data) => {
        this.spaceNotificationModel
          .create({
            space: spaceData._id,
            description: `You've been invited to join ${spaceData.name}`,
            from: user,
            to: data.email,
            link: data.verifyUrl,
          })
          .then((data) => {
            this.userService
              .findByEmail(data.to, {
                ignoreNotFound: true,
              })
              .then((user) => {
                if (user?._id) {
                  this.eventEmitter.emit(
                    socketConfig.events.space.notification.new,
                    {
                      data,
                      receiverIds: [user?._id.toString()],
                    },
                  );
                }
              });
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
      if (!this.isOwnerSpace(spaceData, userId)) {
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
          ...(space.avatar ? { avatar: space.avatar } : {}),
          ...(space.name ? { name: space.name } : {}),
        });
      }
      await spaceData.save();
      return spaceData;
    }
  }

  async createOrEditScript(
    spaceId: string,
    userId: string,
    payload: CreateOrEditScriptDto,
  ) {
    const { name, chatFlow, scriptId } = payload;
    const space = await this.spaceModel.findOne({
      _id: spaceId,
      status: { $ne: StatusSpace.DELETED },
    });

    if (!space) {
      throw new BadRequestException('Space not found');
    }

    if (!this.isAdminSpace(space.members, userId)) {
      throw new ForbiddenException(
        'You do not have permission to create or edit script',
      );
    }

    if (!scriptId) {
      const item: Partial<Script> = {
        name: name,
        chatFlow: chatFlow as ChatFlow,
        lastEditedBy: userId,
        createdBy: userId,
        space: space,
      };
      await this.scriptModel.create(item);
    } else {
      const script = await this.scriptModel.findOne({
        _id: scriptId,
        isDeleted: { $ne: true },
      });
      if (!script) {
        throw new BadRequestException('Script not found');
      }

      script.lastEditedBy = userId;

      if (name) {
        script.name = name;
      }
      if (chatFlow) {
        script.chatFlow = chatFlow as ChatFlow;
      }
      await script.save();
    }

    return true;
  }

  async getSpacesBy(
    userId: string,
    type: 'all_spaces' | 'my_spaces' | 'joined_spaces',
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const query = [
      {
        $match: {
          status: StatusSpace.ACTIVE,
          members: {
            $elemMatch: {
              user: new Types.ObjectId(userId),
              status: MemberStatus.JOINED,
            },
          },
          ...(type === 'my_spaces' && { owner: new Types.ObjectId(userId) }),
          ...(type === 'joined_spaces' && {
            owner: { $ne: new Types.ObjectId(userId) },
          }),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $addFields: {
          owner: { $arrayElemAt: ['$owner', 0] },
        },
      },
      {
        $lookup: {
          from: 'rooms',
          let: { spaceId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$spaceId', '$space'] },
                    { $eq: [RoomStatus.ACTIVE, '$status'] },
                    {
                      $eq: [
                        {
                          $indexOfArray: [
                            '$readBy',
                            new mongoose.Types.ObjectId(userId),
                          ],
                        },
                        -1,
                      ],
                    },
                    {
                      $eq: [
                        {
                          $indexOfArray: [
                            '$deleteFor',
                            new mongoose.Types.ObjectId(userId),
                          ],
                        },
                        -1,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'rooms',
        },
      },
      {
        $addFields: {
          totalNewMessages: { $size: '$rooms' },
        },
      },
      {
        $project: {
          name: 1,
          avatar: 1,
          backgroundImage: 1,
          joinedAt: 1,
          createdAt: 1,
          'members.email': 1,
          'members.joinedAt': 1,
          'members.status': 1,
          'owner.email': 1,
          'owner._id': 1,
          totalNewMessages: 1,
        },
      },
    ];

    const data = await this.spaceModel.aggregate(query).sort({ _id: -1 });

    return data.map((item) => {
      const members = (item.members as Member[]).filter(
        (user) => user.status === MemberStatus.JOINED,
      );
      const joinedAt = (item.members as Member[]).find(
        (item) => item.user?.toString() === user._id.toString(),
      )?.joinedAt;
      return {
        ...item,
        members: members,
        joinedAt: joinedAt,
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
            'members.user': user._id,
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

    const countries = await this.userModel
      .find({
        business: extension?._id,
      })
      .select('language')
      .lean();

    space.members = space.members?.filter(
      (user) => user.status !== MemberStatus.DELETED,
    );
    space.tags = space.tags?.filter((tag) => !tag.isDeleted);
    return {
      ...space,
      extension: extension,
      countries: [...new Set(countries.map((item) => item.language))],
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
  async getExtensionById(id: string) {
    const business = await this.helpDeskBusinessModel
      .findOne({
        _id: id,
        status: { $ne: StatusBusiness.DELETED },
      })
      .populate({
        path: 'user',
        select: selectPopulateField<User>(['name', 'avatar', 'language']),
      })
      .populate('currentScript')
      .populate('space', '-members.verifyToken')
      .lean();

    const chatFLow = business?.currentScript?.chatFlow;

    return {
      ...business,
      currentScript: business?.currentScript?._id,
      chatFlow: chatFLow ?? business?.chatFlow,
    };
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
    if (!this.isOwnerSpace(space, userId)) {
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
  async getClientsByUser(
    spaceId: string,
    query: SearchQueryParamsDto,
    userId: string,
  ) {
    const { q, limit, currentPage } = query;
    const business = await this.helpDeskBusinessModel.findOne({
      space: spaceId,
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
  async editClientProfile(
    spaceId: string,
    clientDto: EditClientDto,
    userId: string,
  ) {
    const { name, phoneNumber, roomId } = clientDto;
    const space = await this.spaceModel.findOne({
      _id: spaceId,
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

    const room = await this.roomsService.findByIdAndUserId(roomId, userId);

    await this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId: room._id.toString(),
      participants: room.participants.map((p) => p._id),
      data: {
        participants: room.participants,
      },
    });
    return true;
  }
  async analyst(spaceId: string, params: AnalystQueryDto, userId: string) {
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
        business.space.tags,
        fromDateBy[type],
        toDateBy[type],
      );
    const totalCompletedConversationPromise =
      this.roomsService.getTotalClientCompletedConversation(
        spaceId,
        business.space.tags,
      );

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
        tags: business.space.tags,
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
    const averageChatDuration = averageResponseChat[0]?.averageDifference;
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
      throw new ConflictException('You are joined this space');
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
  async spaceVerify(userId: string, token: string) {
    const user = await this.userService.findById(userId);
    const space = await this.spaceModel
      .findOne({
        'members.verifyToken': token,
      })
      .populate('owner', 'email')
      .select('name avatar backgroundImage members owner')
      .lean();

    if (!space) {
      throw new BadRequestException('Token is invalid');
    }

    if (space.status === StatusSpace.DELETED) {
      throw new BadRequestException('This space is deleted');
    }

    const member = space.members.find((item) => item.verifyToken === token);

    if (!member || member.email !== user.email) {
      throw new ForbiddenException(
        'You do not have permission to view this invitation',
      );
    }

    if (member.status === MemberStatus.JOINED) {
      throw new ConflictException('You have already joined this space');
    }
    if (
      moment().isAfter(member.expiredAt) ||
      member.status !== MemberStatus.INVITED
    ) {
      throw new GoneException('Token is expired');
    }
    return {
      space: {
        _id: space._id,
        avatar: space.avatar,
        backgroundImage: space.backgroundImage,
        name: space.name,
        owner: space.owner,
      },
      email: member.email,
      verifyToken: member.verifyToken,
      invitedAt: member.invitedAt,
      isExpired: moment().isAfter(member.expiredAt),
    };
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

  async getScriptsBy(
    spaceId: string,
    searchQuery: SearchQueryParamsDto,
    userId: string,
  ) {
    const { q, limit = 10, currentPage = 1 } = searchQuery;
    const extension = await this.helpDeskBusinessModel.findOne({
      space: spaceId,
      status: StatusBusiness.ACTIVE,
    });

    const allItemsPromise = this.scriptModel.aggregate([
      {
        $match: {
          space: new Types.ObjectId(spaceId),
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastEditedBy',
          foreignField: '_id',
          as: 'lastEditedBy',
        },
      },
      {
        $match: {
          $or: [
            { 'createdBy.name': { $regex: q, $options: 'i' } },
            { 'lastEditedBy.name': { $regex: q, $options: 'i' } },
            { name: { $regex: q, $options: 'i' } },
          ],
        },
      },
    ]);

    const query = [
      {
        $match: {
          space: new Types.ObjectId(spaceId),
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastEditedBy',
          foreignField: '_id',
          as: 'lastEditedBy',
        },
      },
      {
        $addFields: {
          lastEditedBy: { $arrayElemAt: ['$lastEditedBy', 0] },
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          isUsing: {
            $cond: [{ $eq: ['$_id', extension?.currentScript] }, true, false],
          },
        },
      },
      {
        $match: {
          $or: [
            { 'createdBy.name': { $regex: q, $options: 'i' } },
            { 'lastEditedBy.name': { $regex: q, $options: 'i' } },
            { name: { $regex: q, $options: 'i' } },
          ],
        },
      },

      {
        $skip: (currentPage - 1) * limit,
      },
      {
        $limit: limit,
      },

      {
        $project: {
          _id: 1,
          name: 1,
          chatFlow: 1,
          'createdBy.name': 1,
          'createdBy.avatar': 1,
          'lastEditedBy.name': 1,
          'lastEditedBy.avatar': 1,
          isUsing: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];
    const dataPromise = this.scriptModel.aggregate(query) as any;
    const [allItems, data] = await Promise.all([allItemsPromise, dataPromise]);

    return {
      totalPage: Math.ceil(allItems.length / limit),
      items: data,
    };
  }
  async getDetailScript(spaceId: string, id: string, userId: string) {
    const script = await this.scriptModel
      .findOne({ _id: id, space: spaceId, isDeleted: { $ne: true } })
      .populate('space')
      .select('name chatFlow space');
    if (!script) {
      throw new BadRequestException('Script not found');
    }
    if (!script.space || script.space.status === StatusSpace.DELETED) {
      throw new BadRequestException('Space not found');
    }
    if (!this.isAdminSpace(script.space.members, userId)) {
      throw new ForbiddenException('You do not permission do view this script');
    }
    script.space = script.space._id as any;
    return script;
  }

  async removeScript(spaceId: string, scriptId: string, userId: string) {
    const script = await this.scriptModel
      .findOne({
        _id: scriptId,
        space: spaceId,
        isDeleted: { $ne: true },
      })
      .populate('space');
    if (!script || script.isDeleted) {
      throw new BadRequestException('Script not found');
    }
    const space = script?.space;
    if (!space) {
      throw new BadRequestException('Space not found');
    }
    if (!this.isOwnerSpace(space, userId)) {
      throw new ForbiddenException(
        'You do not have permission to create or edit script',
      );
    }
    const extension = await this.helpDeskBusinessModel.findOne({
      space: space._id,
    });
    if (extension?.currentScript.toString() === scriptId.toString()) {
      throw new BadRequestException('You cannot delete scripts in use');
    }

    script.isDeleted = true;
    await script.save();
    return null;
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

  async inviteMembers(spaceId: string, userId: string, data: InviteMemberDto) {
    const user = await this.userService.findById(userId);
    const spaceData = await this.spaceModel.findOne({
      _id: spaceId,
      status: { $ne: StatusSpace.DELETED },
    });

    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }
    const inviter = spaceData.members.find(
      (member) =>
        member.user?.toString() === userId.toString() &&
        member.status === MemberStatus.JOINED &&
        member.role === ROLE.ADMIN,
    );
    if (!inviter) {
      throw new ForbiddenException(
        'You do not have permission to invite people as members to the space!',
      );
    }

    if (
      inviter.role === ROLE.ADMIN &&
      userId.toString() !== spaceData.owner.toString()
    ) {
      if (data.members.find((member) => member.role === ROLE.ADMIN)) {
        throw new ForbiddenException(
          'You do not have permission to invite people as admins to the space!',
        );
      }
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

    const uniqueEmails = new Set();
    const newMembers = data.members
      .filter((member) => {
        if (!uniqueEmails.has(member.email)) {
          uniqueEmails.add(member.email);
          return true;
        }
        return false;
      })
      .map((item) => {
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
      this.spaceNotificationModel
        .create({
          space: spaceData._id,
          description: `You've been invited to join ${spaceData.name}`,
          from: user,
          to: data.email,
          link: data.verifyUrl,
        })
        .then((data) => {
          this.userService
            .findByEmail(data.to, {
              ignoreNotFound: true,
            })
            .then((user) => {
              if (user?._id) {
                this.eventEmitter.emit(
                  socketConfig.events.space.notification.new,
                  {
                    data,
                    receiverIds: [user?._id.toString()],
                  },
                );
              }
            })
            .catch(() => {
              console.log('User not found');
            });
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
  async resendInvitation(
    spaceId: string,
    userId: string,
    data: UpdateMemberDto,
  ) {
    const spaceData = await this.spaceModel.findOne({
      status: { $ne: StatusSpace.DELETED },
      _id: spaceId,
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
      (item) =>
        item.email === data.email && item.status !== MemberStatus.DELETED,
    );
    if (index === -1) {
      throw new BadRequestException('User are not invite');
    }

    const token = `${generateSlug()}-${generateSlug()}`;

    const verifyUrl = await this.createVerifyUrl(token);
    await this.spaceNotificationModel
      .create({
        space: spaceData._id,
        description: `You've been invited to join ${spaceData.name}`,
        from: user,
        to: data.email,
        link: verifyUrl,
      })
      .then((data) => {
        this.userService
          .findByEmail(data.to, {
            ignoreNotFound: true,
          })
          .then((user) => {
            if (user?._id) {
              this.eventEmitter.emit(
                socketConfig.events.space.notification.new,
                {
                  data,
                  receiverIds: [user?._id.toString()],
                },
              );
            }
          });
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
  async removeMember(spaceId: string, userId: string, data: RemoveMemberDto) {
    const spaceData = await this.spaceModel.findOne({
      _id: spaceId,
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
      (item) =>
        item.email === data.email && item.status !== MemberStatus.DELETED,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in space');
    }

    spaceData.members[index].status = MemberStatus.DELETED;

    await spaceData.save();
    if (!!spaceData.members[index].user) {
      this.eventEmitter.emit(socketConfig.events.space.member.remove, {
        data,
        receiverIds: [spaceData.members[index].user?.toString()],
      });
    }

    return true;
  }
  async changeRole(spaceId: string, userId: string, data: UpdateMemberDto) {
    const spaceData = await this.spaceModel.findOne({
      status: { $ne: StatusSpace.DELETED },
      _id: spaceId,
    });

    if (!spaceData) {
      throw new BadRequestException('Space not found!');
    }
    if (!this.isAdminSpace(spaceData.members, userId)) {
      throw new ForbiddenException('You do not have permission to change role');
    }

    const index = spaceData.members.findIndex(
      (item) =>
        item.email === data.email && item.status !== MemberStatus.DELETED,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in space');
    }

    spaceData.members[index].role = data.role;

    await spaceData.save();
    return true;
  }

  async createOrEditTag(
    spaceId: string,
    userId: string,
    tagDto: CreateOrEditTagDto,
  ) {
    const { name, color, tagId } = tagDto;
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
    const users = await this.userModel
      .find({ business: { $exists: true } })
      .populate('business');
    for (let user of users) {
      if (user.business) {
        user.space = user.business.space;
        user.save();
      }
    }
    return users;
  }

  async deleteTag(spaceId: string, tagId: string, userId: string) {
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
    const notifications = await this.spaceNotificationModel
      .find({
        to: user.email,
        isDeleted: { $ne: true },
      })
      .sort({ _id: -1 })
      .populate('from', 'name avatar')
      .populate('space')
      .select('-to');
    return notifications.map((item) => {
      const isJoinedSpace = item.space?.members?.find(
        (member) =>
          member.user?.toString() === userId.toString() &&
          member.status === MemberStatus.JOINED,
      );
      item.link = isJoinedSpace
        ? `${envConfig.app.url}/spaces/${item.space._id}/conversations`
        : item.link;
      item.space = item.space._id as any;

      return item;
    });
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
        member.user?.toString() === userId.toString() &&
        member.role === ROLE.ADMIN &&
        member.status === MemberStatus.JOINED,
    );
  }
  isOwnerSpace(space: Space, userId: string) {
    return space?.owner.toString() === userId.toString();
  }

  createVerifyUrl(token: string) {
    return `${envConfig.app.url}/space-verify?token=${token}`;
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
}
