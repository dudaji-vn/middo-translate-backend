import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model, ObjectId, Types } from 'mongoose';
import {
  CursorPaginationInfo,
  ListQueryParamsCursor,
  Pagination,
} from 'src/common/types';
import { selectPopulateField } from 'src/common/utils';
import {
  queryDropRate,
  queryOpenedConversation,
  queryReportByType,
  queryResponseMessage,
  queryResponseTime,
} from 'src/common/utils/query-report';
import { socketConfig } from 'src/configs/socket.config';
import { UpdateRoomPayload } from 'src/events/types/room-payload.type';
import {
  AnalystFilterDto,
  AnalystType,
} from 'src/help-desk/dto/analyst-query-dto';
import { ChartQueryDto } from 'src/help-desk/dto/chart-query-dto';
import { Message, SenderType } from 'src/messages/schemas/messages.schema';
import { convertMessageRemoved } from 'src/messages/utils/convert-message-removed';
import { RecommendQueryDto } from 'src/recommendation/dto/recommend-query-dto';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { HelpDeskBusiness } from 'src/help-desk/schemas/help-desk-business.schema';
import { CreateRoomDto } from './dto';
import { CreateHelpDeskRoomDto } from './dto/create-help-desk-room';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomStatus } from './schemas/room.schema';
import {
  MemberStatus,
  Space,
  StatusSpace,
  Tag,
} from 'src/help-desk/schemas/space.schema';
import * as moment from 'moment';
import { envConfig } from 'src/configs/env.config';
import { pivotChartByType } from 'src/common/utils/date-report';
import { StationsService } from 'src/stations/stations.service';
import { QueryRoomsDto } from 'src/common/dto';
import { Station } from 'src/stations/schemas/station.schema';

const userSelectFieldsString = selectPopulateField<User>([
  '_id',
  'name',
  'avatar',
  'email',
  'language',
  'username',
  'status',
]);

@Injectable()
export class RoomsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly stationService: StationsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(HelpDeskBusiness.name)
    private readonly helpDeskBusinessModel: Model<HelpDeskBusiness>,
  ) {}
  async create(
    createRoomDto: CreateRoomDto,
    creatorId: string,
    stationId?: string,
  ) {
    const participants = await Promise.all(
      [...new Set([creatorId, ...createRoomDto.participants])].map((id) =>
        this.usersService.findById(id),
      ),
    );
    const isGroup = participants.length > 2;
    if (
      !isGroup &&
      participants.length < 2 &&
      participants[0]?._id?.toString() !== creatorId
    ) {
      throw new BadRequestException('Participants must be 2 users');
    }

    if (!isGroup) {
      const room = await this.findByParticipantIdsAndStationId(
        participants.map((p) => p._id),
        stationId,
      );
      if (room) {
        return room;
      }
    }

    const newRoom = new this.roomModel(createRoomDto);
    if (stationId) {
      const station = await this.stationService.findStationByIdAndUserId(
        stationId,
        creatorId,
      );
      newRoom.station = station;
    }
    const admin =
      participants.find((p) => p._id.toString() === creatorId) || ({} as User);

    // add to waiting list first
    if (!createRoomDto?.isHelpDesk) {
      newRoom.participants = [];
      newRoom.participants.push(admin);
      participants.forEach((p) => {
        if (p._id.toString() === creatorId) return;
        if (!p.allowUnknown) {
          newRoom.waitingUsers.push(p);
        }

        if (!isGroup || p.allowUnknown) {
          newRoom.participants.push(p);
        }

        if (!isGroup && !p.allowUnknown) {
          newRoom.status = RoomStatus.WAITING;
        }
      });
    } else {
      newRoom.participants = isGroup
        ? [...new Set(participants)]
        : participants;
    }
    newRoom.name = createRoomDto.name || '';
    if (newRoom.name) {
      newRoom.isSetName = true;
    }
    newRoom.isGroup = isGroup;
    newRoom.admin = admin;
    console.log(newRoom);
    const room = await this.roomModel.create(newRoom);
    const responseRoom = await room.populate([
      {
        path: 'participants',
        select: userSelectFieldsString,
      },
      {
        path: 'admin',
        select: userSelectFieldsString,
      },
      {
        path: 'waitingUsers',
        select: userSelectFieldsString,
      },
      {
        path: 'rejectedUsers',
        select: userSelectFieldsString,
      },
    ]);
    this.eventEmitter.emit(socketConfig.events.room.new, room);
    return responseRoom;
  }

  async accept(roomId: string, userId: string, roomStatus?: RoomStatus) {
    const room = await this.roomModel.findOne({
      _id: roomId,
      waitingUsers: userId,
    });
    const user = await this.usersService.findById(userId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    room.waitingUsers = room.waitingUsers.filter(
      (p) => String(p._id) !== userId,
    );
    if (!room.participants.some((p) => String(p._id) === userId)) {
      room.participants = [...room.participants, user];
    }
    await this.updateRoom(roomId, {
      waitingUsers: room.waitingUsers,
      participants: room.participants,
      status: roomStatus || RoomStatus.ACTIVE,
    });
  }

  async reject(roomId: string, userId: string) {
    const user = await this.usersService.findById(userId);
    const room = await this.roomModel.findOne({
      _id: roomId,
      waitingUsers: userId,
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    room.waitingUsers = room.waitingUsers.filter(
      (p) => String(p._id) !== userId,
    );
    room.rejectedUsers = [...room.rejectedUsers, user];
    await this.updateRoom(roomId, {
      waitingUsers: room.waitingUsers,
      rejectedUsers: room.rejectedUsers,
    });
  }

  async delete(id: string, userId: string) {
    const room = await this.findByIdAndUserId(id, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    await this.roomModel.updateOne(
      {
        _id: room._id,
      },

      { $push: { deleteFor: userId } },
    );
    this.eventEmitter.emit(socketConfig.events.room.delete, {
      roomId: room._id,
      participants: [userId],
    });
    return room;
  }
  async archive(roomId: string, userId: string) {
    const room = await this.findByIdAndUserId(roomId, userId);
    const user = await this.usersService.findById(userId);
    const isPinned = user?.pinRoomIds?.includes(roomId);
    if (isPinned) {
      user.pinRoomIds = user.pinRoomIds.filter((id) => id !== roomId);
    }
    await this.usersService.update(user._id, {
      pinRoomIds: user.pinRoomIds,
    });
    await this.roomModel.updateOne(
      {
        _id: room._id,
      },
      {
        $addToSet: { archiveFor: userId },
      },
    );
    this.eventEmitter.emit(socketConfig.events.room.delete, {
      roomId: room._id,
      participants: [userId],
    });
    return room;
  }
  async unarchive(id: string, userId: string) {
    const room = await this.findByIdAndUserId(id, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    await this.roomModel.updateOne(
      {
        _id: room._id,
      },
      {
        $pull: { archiveFor: userId },
      },
    );
    this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId: room._id,
      participants: [userId],
    });
    return room;
  }
  async deleteContact(roomId: string, userId: string) {
    const room = await this.findByIdAndUserId(roomId, userId);
    const otherUser = room.participants.find(
      (p) => p._id.toString() !== userId,
    );
    await this.roomModel.updateOne(
      {
        _id: room._id,
      },
      {
        status: RoomStatus.WAITING,
        waitingUsers: [...room.waitingUsers, otherUser, userId],
        participants: [],
      },
    );
    const newRoom = await this.findByIdAndUserId(roomId, userId);
    this.eventEmitter.emit(socketConfig.events.room.delete_contact, {
      participants: [...room.participants.map((p: User) => p._id)],
      data: newRoom,
    });
    return room;
  }
  async leaveRoom(id: string, userId: string) {
    const room = await this.findGroupByIdAndUserId(id, userId);
    if (!room.isGroup) {
      throw new Error('Cannot leave room not group');
    }
    if (!room) {
      throw new Error('Room not found');
    }
    room.participants = room.participants.filter(
      (p) => String(p._id) !== userId,
    );
    const isAdmin = room.admin?._id.toString() === userId;
    if (isAdmin && room.participants.length > 0) {
      room.admin = room.participants[0];
    }
    await this.unPinIfExist(room._id.toString(), userId);
    await this.unarchive(id, userId);
    await room.save();
    await room.populate([
      {
        path: 'participants',
        select: userSelectFieldsString,
      },
      {
        path: 'admin',
        select: userSelectFieldsString,
      },
    ]);

    this.eventEmitter.emit(socketConfig.events.room.leave, {
      roomId: room._id,
      userId,
    });
    this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId: room._id,
      participants: room.participants.map((p) => p._id),
      data: {
        participants: room.participants,
      },
    });
    return room;
  }

  async findByParticipantIdsAndStationId(
    participantIds: ObjectId[] | string[],
    stationId?: string,
  ) {
    const room = await this.roomModel
      .findOne({
        station: { $exists: false },
        ...(stationId && { station: stationId }),
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
      })
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: userSelectFieldsString,
        },
      })
      .populate('participants', userSelectFieldsString)
      .populate('admin', userSelectFieldsString);

    return room;
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
    params?: {
      checkExpiredAt?: boolean;
      stationId?: string;
    },
  ) {
    const stationId = params?.stationId;
    const checkExpiredAt = params?.checkExpiredAt;
    const user = await this.usersService.findById(userId);
    let room = await this.roomModel.findOne({
      _id: id,
      $or: [{ waitingUsers: userId }, { participants: userId }],

      status: {
        $in: [RoomStatus.ACTIVE, RoomStatus.ARCHIVED, RoomStatus.WAITING],
      },
    });

    // CASE: Search room by user ID
    if (!room) {
      const participantIds = [...new Set([userId, id])];
      room = await this.roomModel.findOne({
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
        station: { $exists: false },
        status: RoomStatus.ACTIVE,
        ...(stationId && {
          station: stationId,
        }),
      });
    }
    // CASE: Delete contact P2P
    if (!room) {
      const participantIds = [...new Set([userId, id])];
      room = await this.roomModel.findOne({
        station: { $exists: false },
        ...(stationId && {
          station: stationId,
        }),
        $or: [
          {
            waitingUsers: {
              $all: participantIds,
            },
          },
          {
            $and: [{ participants: userId }, { waitingUsers: id }],
          },
          {
            $and: [{ participants: id }, { waitingUsers: userId }],
          },
        ],
      });
    }
    if (!room) {
      const participantIds = [...new Set([userId, id])];
      room = new this.roomModel();
      try {
        const participants = await Promise.all(
          participantIds.map((id) => this.usersService.findById(id)),
        );
        room.participants = participants;
        room.status = RoomStatus.TEMPORARY;
        if (stationId) {
          room.station = stationId as any;
        }
        room.admin = user;
      } catch (error) {
        throw new NotFoundException('Room not found');
      }
    }

    const roomRes = await room.populate([
      {
        path: 'participants',
        select: `${userSelectFieldsString} + tempEmail status phoneNumber`,
      },
      {
        path: 'waitingUsers',
        select: userSelectFieldsString,
      },
      {
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: userSelectFieldsString,
        },
      },
      {
        path: 'admin',
        select: userSelectFieldsString,
      },
      {
        path: 'rejectedUsers',
        select: userSelectFieldsString,
      },
      {
        path: 'space',
        select: 'bot tags name avatar members status',
      },
    ]);

    const data = roomRes.toObject();
    data.participants = data.participants.map((user) => {
      return {
        ...user,
        email:
          user.status === UserStatus.ANONYMOUS ? user.tempEmail : user.email,
      };
    });

    let chatFlow = null;
    if (data.isHelpDesk) {
      if (
        checkExpiredAt &&
        user.status === UserStatus.ANONYMOUS &&
        room.expiredAt &&
        moment().isAfter(room.expiredAt)
      ) {
        throw new NotFoundException('Room not found');
      }
      const space = data.space as Space;
      if (
        user.status !== UserStatus.ANONYMOUS &&
        !this.isAccessRoomBySpace(space, userId)
      ) {
        throw new ForbiddenException('You do not have permission in this room');
      }
      chatFlow = await this.getChatFlowBySpace(space._id);
      delete (data.space as any).members;
    }
    return {
      ...data,
      chatFlow: chatFlow,
      isPinned: user?.pinRoomIds?.includes(id) || false,
    };
  }

  async findWithCursorPaginate(
    queryParams: ListQueryParamsCursor & {
      type?:
        | 'all'
        | 'group'
        | 'contact'
        | 'individual'
        | 'help-desk'
        | 'unread-help-desk'
        | 'archived'
        | 'waiting';
      spaceId?: string;
      stationId?: string;
      status?: RoomStatus;
      domains?: string[];
      tags?: string[];
      countries: string[];
      isGroup?: boolean;
      isUnread?: boolean;
    },
    userId: string,
  ): Promise<Pagination<Room, CursorPaginationInfo>> {
    const {
      cursor,
      type,
      status,
      spaceId,
      domains,
      tags,
      countries = [],
      stationId,
      isUnread,
      isGroup,
    } = queryParams;
    let limit = queryParams.limit;
    const user = await this.usersService.findById(userId);
    let userIds: ObjectId[] = [];
    if (spaceId && countries && countries.length > 0) {
      userIds = (
        await this.usersService.findBySpaceAndCountries(spaceId, countries)
      ).map((item) => item._id);
    }

    const query: FilterQuery<Room> = {
      _id: { $nin: user.pinRoomIds },
      newMessageAt: {
        $lt: cursor
          ? new Date(cursor).toDateString()
          : new Date().toISOString(),
      },
      participants: userId,
      waitingUsers: { $nin: [userId] },
      status: {
        $nin: [RoomStatus.DELETED, RoomStatus.ARCHIVED, RoomStatus.WAITING],
      },
      deleteFor: { $nin: [userId] },
      archiveFor: { $nin: [userId] },
      isHelpDesk: { $ne: true },
      isAnonymous: { $ne: true },
      station: { $exists: false },
      ...(status && { status }),
      ...(countries?.length && {
        $and: [{ participants: { $in: userIds } }, { participants: userId }],
      }),
      ...(tags?.length && { tag: { $in: tags } }),
      ...(domains?.length && { fromDomain: { $in: domains } }),
      ...(stationId && { station: stationId }),
    };

    switch (type) {
      case 'individual':
        Object.assign(query, { isGroup: false });
        break;
      case 'help-desk':
        Object.assign(query, {
          isHelpDesk: true,
          space: { $exists: true, $eq: spaceId },
        });
        break;
      case 'unread-help-desk':
        Object.assign(query, {
          isHelpDesk: true,
          readBy: { $nin: [userId] },
          space: { $exists: true, $eq: spaceId },
        });
        break;
      case 'archived':
        Object.assign(query, { archiveFor: { $in: [userId] } });
        break;
      case 'contact':
        Object.assign(query, {
          isGroup: false,
          status: { $ne: RoomStatus.WAITING },
        });
        delete query.archiveFor;
        // delete query.waitingUsers;
        delete query._id;
        limit = Infinity;
        break;
      case 'waiting':
        Object.assign(query, {
          $or: [
            { waitingUsers: { $in: [userId] } },
            {
              $and: [
                { participants: { $in: [userId] } },
                { status: RoomStatus.WAITING },
              ],
            },
          ],
        });
        delete query.status;
        delete query.waitingUsers;
        delete query.participants;
        // Object.assign(query, { participants: { $nin: [userId] } });
        break;
    }

    // if (isUnread !== undefined) {
    //   if (isUnread) {
    //     query['lastMessage.readBy'] = { $nin: [userId] };
    //   } else {
    //     query['lastMessage.readBy'] = { $in: [userId] };
    //   }
    // }

    if (isGroup !== undefined) {
      query.isGroup = isGroup;
    } else {
      delete query.isGroup;
    }

    const rooms = await this.roomModel
      .find(query)
      .sort({ newMessageAt: -1 })
      .limit(limit)
      .populate({
        path: 'lastMessage',
        populate: [
          {
            path: 'targetUsers',
            select: userSelectFieldsString,
          },
          {
            path: 'sender',
            select: userSelectFieldsString,
          },
          {
            path: 'call',
          },
        ],
      })
      .populate('participants', userSelectFieldsString)
      .populate('waitingUsers', userSelectFieldsString)
      .populate('rejectedUsers', userSelectFieldsString)
      .populate('admin', userSelectFieldsString)
      .populate(
        selectPopulateField<Room>(['space']),
        selectPopulateField<Space>(['tags', 'members', 'status']),
      );

    const pageInfo: CursorPaginationInfo = {
      endCursor: rooms[rooms.length - 1]?.newMessageAt?.toISOString(),
      hasNextPage: rooms.length === limit,
    };
    if (type === 'help-desk' || type === 'unread-help-desk') {
      const space = rooms[0]?.space as Space;
      if (rooms.length > 0 && !this.isAccessRoomBySpace(space, userId)) {
        throw new ForbiddenException(
          'You do not have permission to view rooms in this space',
        );
      }

      return {
        items: rooms.map((room) => {
          const tag = this.getTagByRoom(room);
          return {
            ...room.toObject(),
            tag: tag as Tag,
            space: (room.space as Space)._id,
            isPinned: user?.pinRoomIds?.includes(room._id.toString()) || false,
            lastMessage: convertMessageRemoved(room.lastMessage, userId),
          };
        }),
        pageInfo,
      };
    }

    return {
      items: rooms.map((room) => ({
        ...room.toObject(),
        isPinned: user?.pinRoomIds?.includes(room._id.toString()) || false,
        lastMessage: convertMessageRemoved(room.lastMessage, userId),
        ...(type === 'archived' && { status: RoomStatus.ARCHIVED }),
      })),
      pageInfo,
    };
  }
  search({ query, limit }: { query: FilterQuery<Room>; limit: number }) {
    const rooms = this.roomModel
      .find(query)
      .limit(limit)
      .populate(
        selectPopulateField<Room>(['participants']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['waitingUsers']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['rejectedUsers']),
        userSelectFieldsString,
      )
      .populate({
        path: 'lastMessage',
        populate: [
          {
            path: 'targetUsers',
            select: userSelectFieldsString,
          },
          {
            path: 'sender',
            select: userSelectFieldsString,
          },
        ],
      })
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString)
      .lean();
    return rooms;
  }

  async findById(id: string) {
    const room = await this.roomModel
      .findById(id)
      .populate(
        selectPopulateField<Room>(['participants']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['waitingUsers']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['rejectedUsers']),
        userSelectFieldsString,
      )
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString)
      .populate(
        selectPopulateField<Room>(['lastMessage']),
        selectPopulateField<Message>([
          '_id',
          'content',
          'type',
          'targetUsers',
          'sender',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['space']),
        selectPopulateField<Space>(['name', 'avatar']),
      )
      .populate(
        selectPopulateField<Room>(['station']),
        selectPopulateField<Station>(['name', 'avatar']),
      );
    return room;
  }

  async updateRoom(roomId: string, data: Partial<Room>) {
    const updatedRoom = await this.roomModel
      .findByIdAndUpdate(
        roomId,
        {
          ...data,
        },
        {
          new: true,
        },
      )
      .populate(
        selectPopulateField<Room>(['participants']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['waitingUsers']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['rejectedUsers']),
        userSelectFieldsString,
      )
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString);
    if (!updatedRoom) {
      throw new Error('Room not found');
    }
    const updatePayload: UpdateRoomPayload = {
      roomId: updatedRoom._id.toString(),
      data: {
        ...data,
        ...(data.participants && {
          participants: updatedRoom.participants,
        }),
        ...(data.waitingUsers && {
          waitingUsers: updatedRoom.waitingUsers,
        }),
        ...(data.rejectedUsers && {
          rejectedUsers: updatedRoom.rejectedUsers,
        }),
      },
      participants: updatedRoom?.participants.map((p) => p._id) || [],
    };
    this.eventEmitter.emit(socketConfig.events.room.update, {
      ...updatePayload,
    });
    return updatedRoom;
  }

  async findGroupByIdAndUserId(roomId: string, userId: string) {
    const room = await this.roomModel
      .findOne({
        _id: roomId,
        participants: userId,
        isGroup: true,
      })
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }
  async findGroupByIdAndUserIdWithAdminRole(roomId: string, userId: string) {
    const room = await this.roomModel
      .findOne({
        _id: roomId,
        participants: userId,
        isGroup: true,
        admin: userId,
      })
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString);

    return room;
  }

  async findRoomIdsByQuery({ query }: { query: FilterQuery<Room> }) {
    const data = await this.roomModel.find(query).select('_id');
    return data.map((item) => item._id);
  }
  async addHelpDeskParticipant(
    spaceId: string,
    userId: string,
    memberId: string,
  ) {
    await this.roomModel.updateMany(
      {
        space: new mongoose.Types.ObjectId(spaceId),
        admin: new mongoose.Types.ObjectId(userId),
        isHelpDesk: true,
      },

      { $addToSet: { participants: [memberId] } },
    );
  }

  async updateRoomInfo(roomId: string, data: UpdateRoomDto, userId: string) {
    const room = await this.findGroupByIdAndUserId(roomId, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    const newRoom = await this.updateRoom(roomId, {
      ...data,
      isSetName: data.name ? true : false,
    });
    return {
      room: newRoom,
      isRemoveName: room.name && !data.name,
    };
  }

  async addParticipants(roomId: string, userIds: string[], userId: string) {
    const room = await this.findGroupByIdAndUserId(roomId, userId);

    if (!room) {
      throw new Error('Room not found');
    }

    const participants = await Promise.all(
      userIds.map((id) => this.usersService.findById(id)),
    );
    // check if user is in waiting list or rejected list
    const waitingUsers = room.waitingUsers.filter((p) =>
      userIds.includes(p._id.toString()),
    );
    const rejectedUsers = room.rejectedUsers.filter((p) =>
      userIds.includes(p._id.toString()),
    );
    if (waitingUsers.length > 0) {
      throw new HttpException(
        'User is in waiting list',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (rejectedUsers.length > 0) {
      throw new HttpException(
        'User is in rejected list',
        HttpStatus.BAD_REQUEST,
      );
    }
    // if user not allow unknown, add to waiting list first
    const waitingUsersList = [];
    const newParticipants = [];
    for (const participant of participants) {
      if (participant.allowUnknown) {
        newParticipants.push(participant);
      } else {
        waitingUsersList.push(participant);
      }
    }
    room.waitingUsers = [...room.waitingUsers, ...waitingUsersList];
    room.participants = [...room.participants, ...newParticipants];
    const updatedRoom = await this.updateRoom(roomId, {
      waitingUsers: room.waitingUsers,
      participants: room.participants,
    });
    return updatedRoom;
  }

  async removeParticipant(
    roomId: string,
    userId: string,
    removeUserId: string,
  ) {
    const room = await this.findGroupByIdAndUserIdWithAdminRole(roomId, userId);
    if (!room) {
      throw new ForbiddenException('You are not admin');
    }
    const participants = room.participants.filter(
      (p) => String(p._id) !== removeUserId,
    );
    const waitingUsers = room.waitingUsers.filter(
      (p) => String(p._id) !== removeUserId,
    );
    const rejectedUsers = room.rejectedUsers.filter(
      (p) => String(p._id) !== removeUserId,
    );
    const deleteFor = room.deleteFor.filter((p) => String(p) !== removeUserId);
    const isRejected = room.rejectedUsers.some(
      (p) => String(p._id) === removeUserId,
    );
    if (!isRejected) {
      await this.unPinIfExist(roomId, removeUserId);
      await this.unarchive(roomId, removeUserId);
    }
    return await this.updateRoom(roomId, {
      participants: participants,
      waitingUsers,
      rejectedUsers,
      deleteFor,
    });
  }

  async findRecentChatRooms(
    userId: string,
    notGroup = false,
    query?: RecommendQueryDto,
  ) {
    const rooms = await this.roomModel
      .find({
        participants: userId,
        ...(notGroup ? { isGroup: false } : {}),
        waitingUsers: { $nin: [userId] },
        status: RoomStatus.ACTIVE,
        space: { $exists: false },
        station: { $exists: false },
        ...(query?.spaceId && {
          space: { $exists: true, $eq: query.spaceId },
        }),
        ...(query?.stationId && {
          station: { $exists: true, $eq: query.stationId },
        }),
      })
      .sort({ newMessageAt: -1 })
      .limit(10)
      .populate('participants', userSelectFieldsString)
      .populate('admin', userSelectFieldsString)
      .populate('waitingUsers', userSelectFieldsString)
      .populate('rejectedUsers', userSelectFieldsString)
      .lean();
    if (query?.type === 'help-desk') {
      return rooms.map((item) => {
        return {
          ...item,
          participants: item.participants.map((user) => {
            return {
              ...user,
              email:
                user.status === UserStatus.ANONYMOUS
                  ? user.tempEmail
                  : user.email,
            };
          }),
        };
      });
    }
    return rooms;
  }

  async findOrCreateByIdAndUserId(
    id: string,
    userId: string,
    inCludeDeleted = false,
  ) {
    let room = await this.roomModel.findOne({
      _id: id,
      participants: userId,
      ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
    });

    if (!room) {
      const participantIds = [...new Set([userId, id])];
      room = await this.roomModel.findOne({
        station: { $exists: false },
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
        ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
      });
    }
    if (!room) {
      const participantIds = [id];
      try {
        const participants = await Promise.all(
          participantIds.map((id) => this.usersService.findById(id)),
        );
        room = await this.create(
          {
            isGroup: false,
            participants: participants.map((p) => p._id),
          },
          userId,
        );
      } catch (error) {
        throw new NotFoundException('Room not found');
      }
    }

    return await room.populate([
      {
        path: 'participants',
        select: userSelectFieldsString,
      },
      {
        path: 'waitingUsers',
        select: userSelectFieldsString,
      },
      {
        path: selectPopulateField<Room>(['rejectedUsers']),
        select: userSelectFieldsString,
      },
      {
        path: 'admin',
        select: userSelectFieldsString,
      },
      {
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: userSelectFieldsString,
        },
      },
    ]);
  }

  async pin(roomId: string, userId: string) {
    const room = await this.findByIdAndUserId(roomId, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    const user = await this.usersService.findById(userId);
    const isPinned = user?.pinRoomIds?.includes(roomId);

    if (isPinned) {
      user.pinRoomIds = user.pinRoomIds.filter((id) => id !== roomId);
    } else {
      user.pinRoomIds = [...(user?.pinRoomIds || []), roomId];
    }

    await this.usersService.update(user._id, {
      pinRoomIds: user.pinRoomIds,
    });
  }
  async unPinIfExist(roomId: string, userId: string) {
    const user = await this.usersService.findById(userId);
    if (user?.pinRoomIds?.includes(roomId)) {
      user.pinRoomIds = user.pinRoomIds.filter((id) => id !== roomId);
      await this.usersService.update(user._id, {
        pinRoomIds: user.pinRoomIds,
      });
    }
  }
  async getPinnedRooms(userId: string, query: QueryRoomsDto) {
    const { spaceId, stationId } = query;
    const user = await this.usersService.findById(userId);
    const rooms = await this.roomModel
      .find({
        _id: {
          $in: user.pinRoomIds,
        },
        space: { $exists: false },
        station: { $exists: false },
        status: RoomStatus.ACTIVE,
        participants: userId,
        deleteFor: { $nin: [userId] },
        archiveFor: { $nin: [userId] },
        ...(spaceId && {
          isHelpDesk: true,
          space: { $exists: true, $eq: spaceId },
        }),
        ...(stationId && {
          station: { $exists: true, $eq: stationId },
        }),
      })
      .populate({
        path: 'lastMessage',
        populate: [
          {
            path: 'targetUsers',
            select: userSelectFieldsString,
          },
          {
            path: 'sender',
            select: userSelectFieldsString,
          },
          {
            path: 'call',
          },
        ],
      })
      .populate(
        selectPopulateField<Room>(['participants']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['waitingUsers']),
        userSelectFieldsString,
      )
      .populate(
        selectPopulateField<Room>(['rejectedUsers']),
        userSelectFieldsString,
      )
      .populate(selectPopulateField<Room>(['admin']), userSelectFieldsString)
      .populate(
        selectPopulateField<Room>(['space']),
        selectPopulateField<Space>(['tags', 'members', 'status']),
      );
    // sort by pin order
    const pinRoomIds = user.pinRoomIds;
    rooms.sort((a, b) => {
      const aIndex = pinRoomIds.indexOf(a._id.toString());
      const bIndex = pinRoomIds.indexOf(b._id.toString());
      return aIndex - bIndex;
    });

    if (spaceId) {
      const space = rooms[0]?.space as Space;
      if (space && !this.isAccessRoomBySpace(space, userId)) {
        throw new ForbiddenException(
          'You do not have permission to view pin rooms in this space',
        );
      }
      return rooms.map((room) => {
        const tag = this.getTagByRoom(room);
        return {
          ...room.toObject(),
          tag: tag as Tag,
          space: (room.space as Space)._id,
          isPinned: user?.pinRoomIds?.includes(room._id.toString()) || false,
          lastMessage: convertMessageRemoved(room.lastMessage, userId),
        };
      });
    }
    return rooms.map((room) => ({
      ...room.toObject(),
      isPinned: true,
      lastMessage: convertMessageRemoved(room.lastMessage, userId),
    }));
  }
  async createHelpDeskRoom(
    createRoomDto: CreateHelpDeskRoomDto,
    creatorId: string,
  ) {
    const participants = await Promise.all(
      [...new Set(createRoomDto.participants)].map((id) =>
        this.usersService.findById(id),
      ),
    );

    if (
      participants.length < 2 &&
      participants[0]?._id?.toString() !== creatorId
    ) {
      throw new BadRequestException('Participants must be 2 users');
    }

    const newRoom = new this.roomModel(createRoomDto);
    newRoom.isHelpDesk = true;
    newRoom.participants = participants;
    newRoom.space = createRoomDto.space;
    newRoom.admin = creatorId as any;
    newRoom.readBy = [];
    newRoom.fromDomain = createRoomDto.fromDomain;
    newRoom.expiredAt = moment()
      .add(envConfig.helpDesk.room.expireIn, 'seconds')
      .toDate();

    const room = await this.roomModel.create(newRoom);

    return room;
  }

  async createAnonymousRoom(creatorId: string, name: string) {
    const user = await this.usersService.findById(creatorId);
    return await this.roomModel.create({
      admin: creatorId,
      participants: [user],
      isAnonymous: true,
      name: name,
    });
  }
  async updateReadByLastMessageInRoom(
    roomId: ObjectId | string,
    userId: string,
  ) {
    return await this.roomModel.findByIdAndUpdate(
      roomId,
      {
        $addToSet: { readBy: userId },
      },
      { new: true },
    );
  }
  async updateRoomHelpDesk(roomId: ObjectId, senderType?: SenderType) {
    return await this.roomModel.findByIdAndUpdate(
      roomId,
      {
        ...(senderType === SenderType.ANONYMOUS && {
          expiredAt: moment()
            .add(envConfig.helpDesk.room.expireIn, 'seconds')
            .toDate(),
        }),
      },
      { new: true },
    );
  }

  async changeRoomStatus(id: string, userId: string, status: RoomStatus) {
    const room = await this.findByIdAndUserId(id, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    room.status = status;
    await this.roomModel.updateOne(
      {
        _id: room._id,
      },
      {
        status: room.status,
      },
    );
    return room;
  }

  async changeTagRoom(id: string, userId: string, tagId: string) {
    const room = await this.findByIdAndUserId(id, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    const space = room.space as Space;
    if (!space || !space.tags) {
      throw new BadRequestException(`Space has no tag`);
    }

    const tag = space.tags.find((tag) => tag._id?.toString() === tagId);
    if (!tag && tagId) {
      throw new BadRequestException(`Tag ${tagId} not exist in space`);
    }
    if (room.tag && room.tag?.toString() === tagId) {
      throw new BadRequestException(
        'The current tag is the same as the old tag',
      );
    }

    await this.updateRoom(room._id.toString(), {
      tag: new mongoose.Types.ObjectId(tagId) as any,
    });

    return true;
  }

  async getTotalClientCompletedConversation(
    spaceId: string,
    tags: Tag[],
    fromDate?: Date,
    toDate?: Date,
  ) {
    if (!tags || tags.length === 0) {
      throw new BadRequestException('tags not found');
    }
    const tagCompletedId = tags.find((tag) => tag.name === 'completed')?._id;
    return await this.roomModel.countDocuments({
      space: new mongoose.Types.ObjectId(spaceId),
      tag: tagCompletedId,
      ...(fromDate &&
        toDate && {
          updatedAt: {
            $gte: fromDate,
            $lte: toDate,
          },
        }),
    });
  }
  async changeHelpDeskRoomStatusByUser(spaceId: string, status: RoomStatus) {
    await this.roomModel.updateMany(
      {
        space: new mongoose.Types.ObjectId(spaceId),
        isHelpDesk: true,
      },
      {
        status: status,
      },
    );
    return true;
  }
  async getChartCompletedConversation(payload: ChartQueryDto) {
    const { spaceId, fromDate, toDate, type, tags } = payload;
    if (!tags || tags.length === 0) {
      throw new BadRequestException('tags not found');
    }
    const tagCompletedId = tags.find((tag) => tag.name === 'completed')?._id;

    const query = queryReportByType(
      type,
      [
        {
          $match: {
            space: new mongoose.Types.ObjectId(spaceId),
            tag: tagCompletedId,
            ...(fromDate &&
              toDate && {
                updatedAt: {
                  $gte: fromDate,
                  $lte: toDate,
                },
              }),
          },
        },
      ],
      '$updatedAt',
    );
    return this.roomModel.aggregate(query);
  }
  async getTotalResponseTime(filter: AnalystFilterDto) {
    const query = [
      ...queryResponseTime(filter),
      {
        $group: {
          _id: null,
          averageDifference: { $avg: '$averageDifference' },
        },
      },
    ];

    const data = await this.roomModel.aggregate(query);
    if (!data.length) {
      return 0;
    }
    return parseFloat(data[0]?.averageDifference?.toFixed(2)) || 0;
  }
  async getChartResponseTime(filter: AnalystFilterDto) {
    const query = [
      ...queryResponseTime(filter),
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
          count: {
            $cond: {
              if: { $eq: ['$averageDifference', null] },
              then: 0,
              else: '$averageDifference',
            },
          },
        },
      },
      {
        $sort: {
          day: 1,
        } as any,
      },
    ];
    const data = await this.roomModel.aggregate(query);
    return pivotChartByType(data, filter);
  }

  async getTotalRespondedMessage(filter: AnalystFilterDto) {
    const query = [
      ...queryResponseMessage(filter),
      {
        $group: {
          _id: null,
          totalMessages: { $sum: '$total' },
        },
      },
    ];
    const data = await this.roomModel.aggregate(query);
    if (!data.length) {
      return 0;
    }
    return data[0]?.totalMessages;
  }
  async getChartRespondedMessages(filter: AnalystFilterDto) {
    const { type } = filter;

    const query = [
      ...queryResponseMessage(filter),
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
          total: 1,
        },
      },
      {
        $group: {
          _id: {
            ...(type !== AnalystType.LAST_YEAR && { day: '$day' }),
            year: '$year',
            month: '$month',
          },
          totalMessages: { $sum: '$total' },
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
          count: {
            $cond: {
              if: { $eq: ['$totalMessages', null] },
              then: 0,
              else: '$totalMessages',
            },
          },
        },
      },
      {
        $sort: {
          day: 1,
        } as any,
      },
    ];
    const data = await this.roomModel.aggregate(query);
    return pivotChartByType(data, filter);
  }

  async getTrafficChart(filter: AnalystFilterDto) {
    const { spaceId, fromDate, toDate, fromDomain } = filter;
    return await this.roomModel.aggregate([
      {
        $match: {
          space: new Types.ObjectId(spaceId),
          isHelpDesk: true,
          ...(fromDomain && {
            fromDomain: fromDomain,
          }),
          ...(fromDate &&
            toDate && {
              createdAt: {
                $gte: fromDate,
                $lte: toDate,
              },
            }),
        },
      },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          dayOfWeek: { $dayOfWeek: '$createdAt' },
        },
      },
      {
        $group: {
          _id: {
            hour: '$hour',
            dayOfWeek: '$dayOfWeek',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          x: '$_id.hour',
          y: '$_id.dayOfWeek',
          density: '$count',
        },
      },
      {
        $sort: {
          y: 1,
          x: 1,
        },
      },
    ]);
  }

  getTagByRoom(room: Room) {
    let tag;
    const space = room.space as Space;
    if (space && space.tags && room.tag) {
      tag = space.tags.find(
        (tag) => tag._id.toString() === room.tag?.toString(),
      );
    }
    return tag;
  }

  isAccessRoomBySpace(space: Space, userId: string) {
    return (
      space &&
      space.status !== StatusSpace.DELETED &&
      space.members.find(
        (member) =>
          member.user?.toString() === userId.toString() &&
          member.status === MemberStatus.JOINED,
      )
    );
  }

  async removeTagsBySpaceIdAndTagId(spaceId: string, tagId: string) {
    return await this.roomModel.updateMany(
      {
        space: spaceId,
        tag: tagId,
      },
      {
        tag: null,
      },
    );
  }
  async getChatFlowBySpace(spaceId: ObjectId) {
    const business = await this.helpDeskBusinessModel
      .findOne({ space: spaceId })
      .populate('currentScript')
      .lean();
    if (!business || !business.currentScript) {
      return null;
    }
    return business?.currentScript?.chatFlow;
  }

  async countOpenedConversation(filter: AnalystFilterDto) {
    const { spaceId, fromDate, toDate, fromDomain } = filter;
    return await this.roomModel.countDocuments({
      space: spaceId,
      ...(fromDomain && {
        fromDomain: fromDomain,
      }),
      ...(fromDate &&
        toDate && {
          createdAt: {
            $gte: fromDate,
            $lte: toDate,
          },
        }),
    });
  }

  async countDropRate(filter: AnalystFilterDto) {
    const query = queryDropRate(filter, [{ $count: 'count' }]);
    const dropRatePromise = await this.roomModel.aggregate(query);

    if (!dropRatePromise.length) {
      return 0;
    }
    return dropRatePromise[0]?.count;
  }

  async getChartDropRate(filter: AnalystFilterDto) {
    const query = queryDropRate(filter);
    const queryReport = queryReportByType(filter.type, query, '$expiredAt');
    const data = await this.roomModel.aggregate(queryReport);
    return pivotChartByType(data, filter);
  }
  async getChartOpenedConversation(filter: AnalystFilterDto) {
    const query = queryOpenedConversation(filter);
    const queryReport = queryReportByType(filter.type, query);
    const data = await this.roomModel.aggregate(queryReport);
    return data;
  }
  async getTotalNewMessagesBySpaceIdAndUserId(spaceId: string, userId: string) {
    return await this.roomModel.countDocuments({
      space: spaceId,
      status: RoomStatus.ACTIVE,
      readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      deleteFor: { $ne: new mongoose.Types.ObjectId(userId) },
    });
  }

  async getCurrentScriptBySpace(spaceId: ObjectId) {
    const business = await this.helpDeskBusinessModel
      .findOne({ space: spaceId })
      .lean();
    if (!business || !business.currentScript) {
      return null;
    }
    return business?.currentScript;
  }
  async existRoomByIdAndUserId(roomId: string, userId: string) {
    return await this.roomModel.exists({ _id: roomId, participants: userId });
  }

  async addAnonymousParticipant(id: string, userId: string) {
    const isExist = await this.roomModel.findOne({
      _id: id,
      isAnonymous: true,
    });
    if (!isExist) {
      throw new BadRequestException('room is not exist');
    }

    return await this.roomModel.findByIdAndUpdate(
      id,
      {
        $addToSet: { participants: userId },
      },
      { new: true },
    );
  }

  async forgeDeleteRoomAndUserInRoom(id: string) {
    const room = await this.roomModel.findById(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const participants = room.participants.map((p) => p.toString());
    // Delete all participants
    await this.usersService.forgeDeleteManyAnonymousUser(participants);
    return await this.roomModel.deleteOne({
      _id: id,
    });
  }
  async isAccessAnonymousRoom(roomId: string, userId: string) {
    return await this.roomModel.exists({
      _id: roomId,
      participants: userId,
      $or: [
        {
          isAnonymous: true,
        },
        {
          isHelpDesk: true,
        },
      ],
    });
  }
}
