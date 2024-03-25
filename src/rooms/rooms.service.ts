import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model, ObjectId } from 'mongoose';
import {
  CursorPaginationInfo,
  ListQueryParamsCursor,
  Pagination,
} from 'src/common/types';
import { selectPopulateField } from 'src/common/utils';
import { socketConfig } from 'src/configs/socket.config';
import { UpdateRoomPayload } from 'src/events/types/room-payload.type';
import { Message } from 'src/messages/schemas/messages.schema';
import { convertMessageRemoved } from 'src/messages/utils/convert-message-removed';
import { RecommendQueryDto } from 'src/recommendation/dto/recommend-query-dto';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateRoomDto } from './dto';
import { CreateHelpDeskRoomDto } from './dto/create-help-desk-room';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomStatus } from './schemas/room.schema';
import { queryReportByType } from '../common/utils/query-report';
import { AnalystType } from '../help-desk/dto/analyst-query-dto';
import { ChartQueryDto } from '../help-desk/dto/chart-query-dto';

const userSelectFieldsString = '_id name avatar email username language';
@Injectable()
export class RoomsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
  ) {}
  async createRoom(createRoomDto: CreateRoomDto, creatorId: string) {
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
      const room = await this.findByParticipantIds(
        participants.map((p) => p._id),
      );
      if (room) {
        return room;
      }
    }

    const newRoom = new this.roomModel(createRoomDto);
    newRoom.participants = isGroup ? [...new Set(participants)] : participants;
    newRoom.name = createRoomDto.name || '';
    if (newRoom.name) {
      newRoom.isSetName = true;
    }
    newRoom.isGroup = isGroup;
    newRoom.admin =
      participants.find((p) => p._id.toString() === creatorId) || ({} as User);

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
    ]);
    this.eventEmitter.emit(socketConfig.events.room.new, room);
    return responseRoom;
  }

  async deleteRoom(id: string, userId: string) {
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
    await this.upPinIfExist(room._id.toString(), userId);
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

  async findByParticipantIds(
    participantIds: ObjectId[] | string[],
    inCludeDeleted = false,
    isHelpDesk = false,
  ) {
    const room = await this.roomModel
      .findOne({
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
        ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
        ...(isHelpDesk && { isHelpDesk: isHelpDesk }),
      })
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: userSelectFieldsString,
        },
      })
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      );

    return room;
  }

  async findByIdAndUserId(id: string, userId: string, inCludeDeleted = false) {
    const user = await this.usersService.findById(userId);
    let room = await this.roomModel.findOne({
      _id: id,
      participants: userId,
      ...(inCludeDeleted
        ? {}
        : {
            status: {
              $in: [
                RoomStatus.ACTIVE,
                RoomStatus.ARCHIVED,
                RoomStatus.COMPLETED,
              ],
            },
          }),
    });

    if (!room) {
      const participantIds = [...new Set([userId, id])];
      room = await this.roomModel.findOne({
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
        ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
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
    ]);

    const data = roomRes.toObject();
    data.participants = data.participants.map((user) => {
      return {
        ...user,
        email:
          user.status === UserStatus.ANONYMOUS ? user.tempEmail : user.email,
      };
    });
    return {
      ...data,
      isPinned: user?.pinRoomIds?.includes(id) || false,
    };
  }

  async findWithCursorPaginate(
    queryParams: ListQueryParamsCursor & {
      type?: 'all' | 'group' | 'individual' | 'help-desk' | 'unread-help-desk';
      status?: RoomStatus;
    },
    userId: string,
  ): Promise<Pagination<Room, CursorPaginationInfo>> {
    const { limit = 10, cursor, type, status } = queryParams;

    const user = await this.usersService.findById(userId);

    const query: FilterQuery<Room> = {
      _id: {
        $nin: user.pinRoomIds,
      },
      newMessageAt: {
        $lt: cursor ? new Date(cursor).toISOString() : new Date().toISOString(),
      },
      participants: userId,
      status: {
        $nin: [RoomStatus.DELETED, RoomStatus.ARCHIVED],
      },
      ...(status ? { status: status } : {}),
      deleteFor: { $nin: [userId] },
      isHelpDesk: { $ne: true },
      ...(type === 'group' ? { isGroup: true } : {}),
      ...(type === 'individual' ? { isGroup: false } : {}),
      ...(type === 'help-desk' ? { isHelpDesk: true } : {}),
      ...(type === 'unread-help-desk'
        ? { isHelpDesk: true, readBy: { $nin: [user] } }
        : {}),
    };

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
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      );
    const pageInfo: CursorPaginationInfo = {
      endCursor: rooms[rooms.length - 1]?.newMessageAt?.toISOString(),
      hasNextPage: rooms.length === limit,
    };
    return {
      items: rooms.map((room) => ({
        ...room.toObject(),
        isPinned: user?.pinRoomIds?.includes(room._id.toString()) || false,
        lastMessage: convertMessageRemoved(room.lastMessage, userId),
      })),
      pageInfo,
    };
  }
  async search({
    query,
    limit,
  }: {
    query: FilterQuery<Room>;
    limit: number;
  }): Promise<Room[]> {
    const rooms = await this.roomModel
      .find(query)
      .limit(limit)
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
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
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .lean();
    return rooms;
  }

  async findById(id: string) {
    const room = await this.roomModel
      .findById(id)
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['lastMessage']),
        selectPopulateField<Message>([
          '_id',
          'content',
          'type',
          'targetUsers',
          'sender',
        ]),
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
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      )
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );
    if (!updatedRoom) {
      throw new Error('Room not found');
    }
    const updatePayload: UpdateRoomPayload = {
      roomId,
      data,
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
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );

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
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );

    return room;
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
    room.participants = [...room.participants, ...participants];
    const participantIds = room.participants.map((p) => p._id.toString());
    await room.updateOne({
      participants: [...new Set(participantIds)],
    });

    await room.populate(
      selectPopulateField<Room>(['participants']),
      selectPopulateField<User>(['_id', 'name', 'avatar', 'email', 'language']),
    );

    this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId,
      participants: room.participants.map((p) => p._id),
      data: {
        participants: room.participants,
      },
    });
    return await room.populate([
      {
        path: 'participants',
        select: userSelectFieldsString,
      },
      {
        path: 'admin',
        select: userSelectFieldsString,
      },
    ]);
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
    room.participants = room.participants.filter(
      (p) => String(p._id) !== removeUserId,
    );
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
    this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId,
      participants: room.participants.map((p) => p._id),
      data: {
        participants: room.participants,
      },
    });
    return room;
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
        status: RoomStatus.ACTIVE,
        isHelpDesk: { $ne: true },
        ...(query?.type === 'help-desk' ? { isHelpDesk: true } : {}),
      })
      .sort({ newMessageAt: -1 })
      .limit(10)
      .populate('participants')
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
        room = await this.createRoom(
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
  async upPinIfExist(roomId: string, userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.pinRoomIds.includes(roomId)) {
      return;
    }
    user.pinRoomIds = [roomId, ...user.pinRoomIds];
    await this.usersService.update(user._id, {
      pinRoomIds: user.pinRoomIds,
    });
  }
  async getPinnedRooms(userId: string) {
    const user = await this.usersService.findById(userId);
    const rooms = await this.roomModel
      .find({
        _id: {
          $in: user.pinRoomIds,
        },
        status: RoomStatus.ACTIVE,
        participants: userId,
        deleteFor: { $nin: [userId] },
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
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        selectPopulateField<Room>(['admin']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      );
    // sort by pin order
    const pinRoomIds = user.pinRoomIds;
    rooms.sort((a, b) => {
      const aIndex = pinRoomIds.indexOf(a._id.toString());
      const bIndex = pinRoomIds.indexOf(b._id.toString());
      return aIndex - bIndex;
    });
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

    const oldRoom = await this.findByParticipantIds(
      participants.map((p) => p._id),
      true,
    );
    if (oldRoom) {
      return oldRoom;
    }

    const newRoom = new this.roomModel(createRoomDto);
    newRoom.isHelpDesk = true;
    newRoom.participants = participants;
    newRoom.admin =
      participants.find((p) => p._id.toString() === creatorId) || ({} as User);
    newRoom.readBy = createRoomDto.participants;

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
    ]);
    this.eventEmitter.emit(socketConfig.events.room.new, room);
    return responseRoom;
  }
  async updateReadByLastMessageInRoom(roomId: ObjectId, userId: string) {
    return await this.roomModel.findByIdAndUpdate(
      roomId,
      {
        $addToSet: { readBy: userId },
      },
      { new: true },
    );
  }
  async updateReadByWhenSendNewMessage(roomId: ObjectId, userId: string) {
    return await this.roomModel.findByIdAndUpdate(
      roomId,
      {
        readBy: [userId],
      },
      { new: true },
    );
  }

  async changeRoomStatus(id: string, userId: string, status: RoomStatus) {
    const room = await this.findByIdAndUserId(id, userId, true);
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
  async getTotalClientCompletedConversation(
    userId: string,
    fromDate?: Date,
    toDate?: Date,
  ) {
    return await this.roomModel.countDocuments({
      admin: userId,
      status: RoomStatus.ACTIVE,
      ...(fromDate &&
        toDate && {
          updatedAt: {
            $gte: fromDate,
            $lte: toDate,
          },
        }),
    });
  }
  async changeHelpDeskRoomStatusByUser(userId: string, status: RoomStatus) {
    await this.roomModel.updateMany(
      {
        admin: userId,
        isHelpDesk: true,
      },
      {
        status: status,
      },
    );
    return true;
  }
  async getChartCompletedConversation(payload: ChartQueryDto) {
    const { userId, fromDate, toDate, type } = payload;
    const query = queryReportByType(
      type,
      [
        {
          $match: {
            admin: new mongoose.Types.ObjectId(userId),
            status: RoomStatus.ACTIVE,
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
  async getAverageResponseChat() {
    const query = [
      {
        $match: {
          status: RoomStatus.ACTIVE,
          updatedAt: { $exists: true },
          newMessageAt: { $exists: true },
        },
      },
      {
        $project: {
          timeDifference: {
            $subtract: ['$newMessageAt', '$updatedAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageDifference: { $avg: '$timeDifference' },
        },
      },
    ];
    return await this.roomModel.aggregate(query);
  }
}
