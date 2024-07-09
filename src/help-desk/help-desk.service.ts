import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import mongoose, { Model, ObjectId, PipelineStage, Types } from 'mongoose';
import { selectPopulateField } from 'src/common/utils';
import { generateSlug } from 'src/common/utils/generate-slug';
import {
  queryGroupByLanguage,
  queryRating,
  queryReportByType,
  queryVisitor,
} from 'src/common/utils/query-report';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import {
  AnalystFilterDto,
  AnalystQueryDto,
  AnalystType,
} from './dto/analyst-query-dto';
import { AnalystResponseDto } from './dto/analyst-response-dto';
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
import { calculateRate } from '../common/utils/calculate-rate';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditBusinessDto as CreateOrEditExtensionDto } from './dto/create-or-edit-business-dto';
import { CreateOrEditScriptDto } from './dto/create-or-edit-script-dto';
import {
  CreateOrEditSpaceDto,
  CreateOrEditTagDto,
  InviteMemberDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/create-or-edit-space-dto';
import { ValidateInviteStatus } from './dto/validate-invite-dto';
import { VisitorDto } from './dto/visitor-dto';
import { ChatFlow } from './schemas/chat-flow.schema';
import { SpaceNotification } from './schemas/space-notifications.schema';
import { Member, Script, Space, StatusSpace } from './schemas/space.schema';
import { Visitor } from './schemas/visitor.schema';
import { pivotChartByType } from 'src/common/utils/date-report';
import { NotificationService } from 'src/notifications/notifications.service';

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
    @InjectModel(Visitor.name)
    private visitorModel: Model<Visitor>,
    private userService: UsersService,
    private roomsService: RoomsService,
    private messagesService: MessagesService,
    private mailService: MailService,
    private notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createClient(businessId: string, info: CreateClientDto) {
    const slug = generateSlug();
    const business = await this.helpDeskBusinessModel
      .findById(businessId)
      .populate('space');

    if (!business || !business.space) {
      throw new BadRequestException('Business or space not found');
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

    const owner = business.space.owner?.toString();

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
        senderId: owner,
        space: business.space._id,
        fromDomain: info.fromDomain,
      },
      owner,
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
        },
        owner,
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
    const who = await this.userService.findById(userId);
    if (String(who?._id) != String(space.owner))
      this.notificationService.sendNotification({
        body: `${who?.name} updated the Extension`,
        title: `${envConfig.app.extension_name} - ${space.name}`,
        link: `${envConfig.app.url}/spaces/${spaceId}/settings`,
        userIds: [space.owner.toString()],
        roomId: '',
        destinationApp: 'extension',
      });
    return extension;
  }

  async createOrEditSpace(userId: string, space: CreateOrEditSpaceDto) {
    const user = await this.userService.findById(userId);
    const senderName = user?.name;
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
      members.forEach((data) => {
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
                  this.notificationService.sendNotification({
                    body: `${senderName} has invited you to join the "${spaceData.name}" space`,
                    title: `${envConfig.app.extension_name}`,
                    link: data.link,
                    userIds: [user._id.toString()],
                    roomId: '',
                    destinationApp: 'extension',
                  });
                }
              });
          });
        this.mailService.sendMail(
          data.email,
          `${senderName} has invited you to join the ${spaceData.name} space`,
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
      if (spaceData.members && spaceData.members.length > 0) {
        this.eventEmitter.emit(socketConfig.events.space.update, {
          receiverIds: spaceData.members
            .filter(
              (item) =>
                item.status === MemberStatus.JOINED &&
                item?.user?.toString() !== userId,
            )
            .map((item) => item.user?.toString()),
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

    if (space.members && space.members.length > 0) {
      this.eventEmitter.emit(socketConfig.events.space.update, {
        receiverIds: space.members
          .filter(
            (item) =>
              item.status === MemberStatus.JOINED &&
              item?.user?.toString() !== userId,
          )
          .map((item) => item.user?.toString()),
      });

      if (space.owner.toString() !== userId) {
        const action = scriptId ? 'updated' : 'created';
        const doer = await this.userService.findById(userId);
        this.notificationService.sendNotification({
          body: `${doer?.name} has ${action} the script ${name}`,
          title: `${envConfig.app.extension_name} - ${space.name}`,
          link: `${envConfig.app.url}/spaces/${spaceId}/scripts`,
          userIds: [space.owner.toString()],
          roomId: '',
          destinationApp: 'extension',
        });
      }
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

    const extensionPromise = this.helpDeskBusinessModel
      .findOne({
        space: new Types.ObjectId(spaceId),
        status: { $ne: StatusBusiness.DELETED },
      })
      .select('-space')
      .lean();

    const countriesPromise = this.userModel
      .find({
        space: space?._id,
      })
      .select('language')
      .lean();
    const totalNewMessagesPromise =
      this.roomsService.getTotalNewMessagesBySpaceIdAndUserId(spaceId, userId);

    const [extension, countries, totalNewMessages] = await Promise.all([
      extensionPromise,
      countriesPromise,
      totalNewMessagesPromise,
    ]);

    space.members = space.members
      ?.filter((user) => user.status !== MemberStatus.DELETED)
      .map((item) => {
        const userId = item?.user;
        delete item.user;
        return {
          ...item,
          _id: userId,
        };
      });
    space.tags = space.tags?.filter((tag) => !tag.isDeleted);

    return {
      ...space,
      extension: extension,
      countries: [...new Set(countries.map((item) => item.language))],
      totalNewMessages: totalNewMessages,
    };
  }

  async getMembers(userId: string, spaceId: string) {
    const space = await this.spaceModel
      .findOne({
        _id: spaceId,
        status: { $ne: StatusSpace.DELETED },
        members: {
          $elemMatch: {
            user: new Types.ObjectId(userId),
            status: MemberStatus.JOINED,
          },
        },
      })
      .populate('owner', 'email')
      .populate('members.user', '_id name avatar username')
      .select('members.status members.role')
      .lean();

    if (!space) {
      throw new BadRequestException('Space not found');
    }
    return space.members.filter(
      (item) => item.user && item.status === MemberStatus.JOINED,
    );
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
    const space = await this.spaceModel.findOne({
      _id: spaceId,
      status: StatusSpace.ACTIVE,
    });
    if (!space) {
      throw new BadRequestException('space not found');
    }
    const data = await this.userService.getClientsByUser({
      q,
      limit,
      currentPage,
      spaceId: spaceId,
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
    const { type, fromDate, toDate, domain, memberId } = params;
    const today = moment().endOf('date').toDate();
    const fromDateBy: Record<AnalystType, Date> = {
      [AnalystType.LAST_WEEK]: moment()
        .subtract('6', 'd')
        .startOf('date')
        .toDate(),
      [AnalystType.LAST_MONTH]: moment()
        .subtract('1', 'months')
        .startOf('date')
        .toDate(),
      [AnalystType.LAST_YEAR]: moment()
        .subtract('1', 'years')
        .startOf('date')
        .toDate(),
      [AnalystType.CUSTOM]: moment(fromDate).startOf('date').toDate(),
    };
    const toDateBy: Record<AnalystType, Date> = {
      [AnalystType.LAST_WEEK]: today,
      [AnalystType.LAST_MONTH]: today,
      [AnalystType.LAST_YEAR]: today,
      [AnalystType.CUSTOM]: moment(toDate).endOf('date').toDate(),
    };
    const analystFilter: AnalystFilterDto = {
      spaceId: spaceId,
      fromDate: fromDateBy[type],
      toDate: toDateBy[type],
      fromDomain: domain,
      type: type,
      memberId: memberId,
    };

    const totalVisitorPromise = this.countAnalyticsVisitor({
      spaceId,
      fromDomain: domain,
    });
    const totalClientsPromise = this.roomsService.countOpenedConversation({
      spaceId: spaceId,
      fromDomain: domain,
    });
    const totalDropRatePromise = this.roomsService.countDropRate({
      spaceId: spaceId,
      fromDomain: domain,
    });

    const totalResponseTimePromise = this.roomsService.getTotalResponseTime({
      spaceId,
      fromDomain: domain,
      memberId: memberId,
    });

    const averageRatingPromise = this.getAverageRating(analystFilter);
    const totalRespondedMessagesPromise =
      this.roomsService.getTotalRespondedMessage({
        spaceId,
        fromDomain: domain,
        memberId: memberId,
      });

    const totalVisitorWithTimePromise =
      this.countAnalyticsVisitor(analystFilter);
    const totalClientsWithTimePromise =
      this.roomsService.countOpenedConversation(analystFilter);

    const dropRateWithTimePromise =
      this.roomsService.countDropRate(analystFilter);
    const responseTimePromise =
      this.roomsService.getTotalResponseTime(analystFilter);
    const totalRespondedMessagesWithTimePromise =
      this.roomsService.getTotalRespondedMessage(analystFilter);

    const conversationLanguagePromise = this.analystByLanguage(analystFilter);

    const newClientsChartPromise =
      this.getChartOpenedConversation(analystFilter);

    const dropRatesChartPromise =
      this.roomsService.getChartDropRate(analystFilter);

    const ratingsChartPromise = this.getChartRating(analystFilter);
    const responseTimeChartPromise =
      this.roomsService.getChartResponseTime(analystFilter);

    const visitorChartPromise = this.getChartVisitor(analystFilter);
    const respondedMessagesChartPromise =
      this.roomsService.getChartRespondedMessages(analystFilter);
    const trafficTrackPromise = this.getTrafficChart(analystFilter);
    const chartConversationLanguagePromise =
      this.getChartConversationLanguage(analystFilter);

    const [
      totalVisitor,
      totalClients,
      totalDropRate,
      averageRating,
      totalResponseTime,
      totalRespondedMessages,
      totalVisitorWithTime,
      totalClientsWithTime,
      responseTime,
      totalDropRateWithTime,
      totalRespondedMessagesWithTime,
      conversationLanguage,
      trafficTrack,
      chartConversationLanguage,
    ] = await Promise.all([
      totalVisitorPromise,
      totalClientsPromise,
      totalDropRatePromise,
      averageRatingPromise,
      totalResponseTimePromise,
      totalRespondedMessagesPromise,
      totalVisitorWithTimePromise,
      totalClientsWithTimePromise,
      responseTimePromise,
      dropRateWithTimePromise,
      totalRespondedMessagesWithTimePromise,
      conversationLanguagePromise,
      trafficTrackPromise,
      chartConversationLanguagePromise,
    ]);

    const [
      newClientsChart,
      ratingsChart,
      responseChart,
      dropRatesChart,
      visitorChart,
      respondedMessagesChart,
    ] = await Promise.all([
      newClientsChartPromise,
      ratingsChartPromise,
      responseTimeChartPromise,
      dropRatesChartPromise,
      visitorChartPromise,
      respondedMessagesChartPromise,
    ]);

    return {
      isNotEnoughData: !business || (!domain && !totalVisitor && !totalClients),
      analysis: {
        newVisitor: {
          value: totalVisitorWithTime,
          growth: calculateRate(totalVisitorWithTime, totalVisitor),
          total: totalVisitor,
        },
        openedConversation: {
          value: totalClientsWithTime,
          growth: calculateRate(totalClientsWithTime, totalClients),
          total: totalClients,
        },

        dropRate: {
          value: totalDropRateWithTime,
          growth: calculateRate(totalDropRateWithTime, totalDropRate),
          total: totalDropRate,
        },

        responseTime: {
          value: responseTime,
          growth: calculateRate(responseTime, totalResponseTime),
          total: totalResponseTime,
        },
        customerRating: {
          value: averageRating.value,
          total: averageRating.total,
        },
        responsedMessage: {
          value: totalRespondedMessagesWithTime,
          growth: calculateRate(
            totalRespondedMessagesWithTime,
            totalRespondedMessages,
          ),
          total: totalRespondedMessages,
        },
      },
      chart: {
        newVisitor: visitorChart,
        openedConversation: newClientsChart,
        dropRate: dropRatesChart,
        responseTime: responseChart,
        customerRating: ratingsChart,
        responsedMessage: respondedMessagesChart,
        conversationLanguage: chartConversationLanguage,
      },
      conversationLanguage: conversationLanguage,
      trafficTrack: trafficTrack,
    };
  }
  async analystByLanguage(filter: AnalystFilterDto) {
    const dataWithTime = await this.userModel.aggregate(
      queryGroupByLanguage(filter),
    );

    if (!dataWithTime.length) {
      return [];
    }
    return dataWithTime
      .map((item) => {
        return {
          ...item,
          count: item?.count,
        };
      })
      .filter((item) => item?.count > 0)
      .sort((a, b) => b?.count - a?.count);
  }

  async getChartConversationLanguage(filter: AnalystFilterDto) {
    const data = await this.userModel.aggregate(queryGroupByLanguage(filter));
    const total = data.reduce((sum, item) => sum + item?.count, 0);

    const dataCalculate = data
      .map((item) => {
        return {
          label: item?.language,
          value: item?.count / total,
        };
      })
      .sort((a, b) => b.value - a.value);
    if (dataCalculate.length <= 3) {
      return dataCalculate;
    }
    return [
      dataCalculate[0],
      dataCalculate[1],
      dataCalculate[2],
      {
        label: 'others',
        value:
          1 -
          (dataCalculate[0]?.value +
            dataCalculate[1]?.value +
            dataCalculate[2]?.value),
      },
    ];
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
      const memberIdsToNotify = space.members
        .filter(
          (item) =>
            item.status === MemberStatus.JOINED && item.role !== ROLE.MEMBER, // notify to others ADMIN, MODERATOR
        )
        .map((item) => String(item.user));

      space.members[memberIndex].status = MemberStatus.JOINED;
      space.members[memberIndex].joinedAt = new Date();
      space.members[memberIndex].user = userId;
      await space.save();

      if (memberIdsToNotify?.length) {
        this.notificationService.sendNotification({
          body: `${user.name} has joined "${space.name}"`,
          title: `${envConfig.app.extension_name} - ${space.name}`,
          link: `${envConfig.app.url}/spaces/${space._id}/settings`,
          userIds: memberIdsToNotify,
          roomId: '',
          destinationApp: 'extension',
        });
      }
      await this.roomsService.addHelpDeskParticipant(
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
      .select('name avatar backgroundImage members owner status')
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
      {
        $sort: {
          _id: -1,
        },
      } as PipelineStage,
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
        'You do not have permission to remove script',
      );
    }
    const extension = await this.helpDeskBusinessModel.findOne({
      space: space._id,
    });

    if (extension?.currentScript?.toString() === scriptId.toString()) {
      throw new BadRequestException('You cannot delete script in use');
    }

    script.isDeleted = true;
    await script.save();
    if (space.members && space.members.length > 0) {
      this.eventEmitter.emit(socketConfig.events.space.update, {
        receiverIds: space.members
          .filter(
            (item) =>
              item.status === MemberStatus.JOINED &&
              item?.user?.toString() !== userId,
          )
          .map((item) => item.user?.toString()),
      });
    }

    return null;
  }
  async removeScripts(spaceId: string, userId: string, scriptIds: string[]) {
    const space = await this.spaceModel.findById(spaceId);
    if (!space) {
      throw new BadRequestException('Space not found');
    }
    if (!this.isOwnerSpace(space, userId)) {
      throw new ForbiddenException(
        'You do not have permission to remove scripts',
      );
    }
    const extension = await this.helpDeskBusinessModel.findOne({
      space: space._id,
    });

    if (
      extension &&
      extension.currentScript &&
      scriptIds.includes(extension.currentScript.toString())
    ) {
      throw new BadRequestException('You cannot delete script in use');
    }
    await this.scriptModel.updateMany(
      {
        _id: { $in: scriptIds },
      },
      {
        isDeleted: true,
      },
    );
    if (space.members && space.members.length > 0) {
      this.eventEmitter.emit(socketConfig.events.space.update, {
        receiverIds: space.members
          .filter(
            (item) =>
              item.status === MemberStatus.JOINED &&
              item?.user?.toString() !== userId,
          )
          .map((item) => item.user?.toString()),
      });
    }
    return true;
  }

  async getAverageRating(filter: AnalystFilterDto): Promise<{
    value: number;
    total: number;
  }> {
    const result = await this.helpDeskBusinessModel.aggregate([
      ...queryRating(filter),
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
          value: result[0]?.averageRating
            ? parseFloat(result[0]?.averageRating?.toFixed(1))
            : 0,
          total: result[0]?.numberPeopleRating,
        }
      : {
          value: 0,
          total: 0,
        };
  }

  async getChartRating(filter: AnalystFilterDto) {
    const { type } = filter;
    const pipeRating = [
      ...queryRating(filter),
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

    const data = await this.helpDeskBusinessModel.aggregate(pipeRating);
    return pivotChartByType(data, filter);
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

  async inviteMembers(spaceId: string, userId: string, data: InviteMemberDto) {
    const user = await this.userService.findById(userId);
    const senderName = user?.name;
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
        (item) =>
          item.email === member.email && item.status !== MemberStatus.DELETED,
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
                this.notificationService.sendNotification({
                  body: `${senderName} has invited you to join the "${spaceData.name}" space`,
                  title: `${envConfig.app.extension_name} - ${spaceData.name}`,
                  link: data.link,
                  userIds: [user?._id.toString()],
                  roomId: '',
                  destinationApp: 'extension',
                });
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
    const senderName = user?.name;
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
              this.notificationService.sendNotification({
                body: `${senderName} has invited you to join the "${spaceData.name}" space`,
                title: `${envConfig.app.extension_name}`,
                link: data.link,
                userIds: [user?._id.toString()],
                roomId: '',
                destinationApp: 'extension',
              });
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
    const removedUser = spaceData.members[index];
    const filterMemberIds = spaceData.members
      .filter(
        (item) =>
          item.status === MemberStatus.JOINED &&
          ![userId, removedUser.user?.toString()].includes(
            item?.user?.toString(),
          ),
      )
      .map((item) => item.user?.toString());
    if (!!removedUser.user) {
      this.eventEmitter.emit(socketConfig.events.space.member.remove, {
        data,
        receiverIds: [removedUser.user?.toString()],
      });
      this.eventEmitter.emit(socketConfig.events.space.update, {
        data,
        receiverIds: filterMemberIds,
      });
      const usersToNotify = spaceData.members
        .filter(
          (item) =>
            item.status === MemberStatus.JOINED && // joined
            item.role === ROLE.ADMIN && // admin only
            item.user?.toString() !== userId.toString(), // not the user who remove
        )
        .map((item) => String(item.user));

      const userRemove = await this.userService.findById(userId);
      this.notificationService.sendNotification({
        title: `${envConfig.app.extension_name} - ${spaceData.name}`,
        body: `${userRemove.name} has removed "${removedUser.email}" from "${spaceData.name}"`,
        link: `${envConfig.app.url}/spaces/${spaceId}/settings`,
        userIds: usersToNotify,
        roomId: '',
        destinationApp: 'extension',
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

    const isOwnerSpace = this.isOwnerSpace(spaceData, userId);
    if (!isOwnerSpace) {
      throw new ForbiddenException('You do not have permission to change role');
    }

    const index = spaceData.members.findIndex(
      (item) =>
        item.email === data.email && item.status !== MemberStatus.DELETED,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in space');
    }
    const member = spaceData.members[index];

    if (member?.user?.toString() === userId.toString()) {
      throw new BadRequestException('You cannot change role of your self');
    }

    spaceData.members[index].role = data.role;

    await spaceData.save();
    this.notificationService.sendNotification({
      body: `You have been changed to ${data.role}`,
      title: `${envConfig.app.extension_name} - ${spaceData.name}`,
      link:
        data.role === ROLE.ADMIN
          ? `${envConfig.app.url}/spaces/${spaceId}/settings`
          : `${envConfig.app.url}/spaces/${spaceId}/conversations`,
      userIds: [String(member.user)],
      roomId: '',
      destinationApp: 'extension',
    });
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
      const isExistTag = space.tags.find(
        (item) =>
          item.name &&
          item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
          !item.isDeleted,
      );
      if (isExistTag) {
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
    for (const user of users) {
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
    await this.roomsService.removeTagsBySpaceIdAndTagId(spaceId, tagId);
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

  async addVisitor(extensionId: string, visitor: VisitorDto) {
    const { domain, trackingId } = visitor;

    const extension = await this.helpDeskBusinessModel.findOne({
      _id: extensionId,
      status: { $ne: StatusBusiness.DELETED },
    });
    if (!extension) {
      throw new BadRequestException('Extension not found');
    }
    if (!extension.domains.includes(domain)) {
      throw new BadRequestException('Domain not exist on this space');
    }
    if (!extension.space || extension?.space?.status === StatusSpace.DELETED) {
      throw new BadRequestException('Space not found');
    }

    if (trackingId) {
      const data = this.visitorModel.findByIdAndUpdate(
        trackingId,
        { $push: { trackings: new Date() } },
        { new: true },
      );
      return data;
    } else {
      return await this.visitorModel.create({
        space: extension.space,
        fromDomain: domain,
        trackings: new Date(),
      });
    }
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

  async countAnalyticsVisitor(filter: AnalystFilterDto) {
    const result = await this.visitorModel.aggregate([
      ...queryVisitor(filter),
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
        },
      },
    ]);
    return result.length > 0 ? result[0]?.totalCount : 0;
  }

  async getChartOpenedConversation(filter: AnalystFilterDto) {
    const data = await this.roomsService.getChartOpenedConversation(filter);

    const pivotData = pivotChartByType(data, filter, true);

    const mappedData = await Promise.all(
      pivotData.map(async (item: any) => {
        const pipeline = queryGroupByLanguage({
          spaceId: filter.spaceId,
          fromDomain: filter.fromDomain,
          fromDate: moment(item.date, 'DD/MM/YYYY').startOf('date').toDate(),
          toDate: moment(item.date, 'DD/MM/YYYY')
            .endOf(filter.type === AnalystType.LAST_YEAR ? 'month' : 'date')
            .toDate(),
        });
        const aggregatedData = await this.userModel.aggregate(pipeline);
        delete item.date;
        return {
          ...item,
          openedConversation: aggregatedData,
        };
      }),
    );

    return mappedData;
  }

  async getChartVisitor(filter: AnalystFilterDto) {
    const query = queryVisitor(filter);
    const queryReport = queryReportByType(filter.type, query, '$trackings');
    const data = await this.visitorModel.aggregate(queryReport);
    return pivotChartByType(data, filter);
  }
  async getTrafficChart(filter: AnalystFilterDto) {
    const pivotData = await this.roomsService.getTrafficChart(filter);
    const mappedData = await Promise.all(
      pivotData.map(async (item: any) => {
        const pipeline = queryGroupByLanguage({
          spaceId: filter.spaceId,
          fromDomain: filter.fromDomain,
          fromDate: filter.fromDate,
          toDate: filter.toDate,
          hour: item.x,
          dayOfWeek: item.y,
        });
        const aggregatedData = await this.userModel.aggregate(pipeline);
        delete item.date;
        return {
          ...item,
          openedConversation: aggregatedData,
        };
      }),
    );
    return mappedData;
  }
}
