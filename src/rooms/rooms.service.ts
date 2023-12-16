import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ObjectId } from 'mongoose';
import {
  CursorPaginationInfo,
  ListQueryParamsCursor,
  Pagination,
} from 'src/common/types';
import { selectPopulateField } from 'src/common/utils';
import { socketConfig } from 'src/configs/socket.config';
import { UpdateRoomPayload } from 'src/events/types/room-payload.type';
import { convertMessageRemoved } from 'src/messages/utils/convert-message-removed';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateRoomDto } from './dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomStatus } from './schemas/room.schema';

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
    newRoom.isGroup = isGroup;
    newRoom.admin =
      participants.find((p) => p._id.toString() === creatorId) || ({} as User);

    const room = await this.roomModel.create(newRoom);
    return room;
  }

  async deleteRoom(id: string, userId: string) {
    const room = await this.findByIdAndUserId(id, userId);
    if (!room) {
      throw new Error('Room not found');
    }
    room.status = RoomStatus.DELETED;
    await room.save();
    this.eventEmitter.emit(socketConfig.events.room.delete, {
      roomId: room._id,
      participants: room.participants.map((p) => p._id),
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
    const isAdmin = room.admin._id.toString() === userId;
    if (isAdmin && room.participants.length > 0) {
      room.admin = room.participants[0];
    }
    await room.save();
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
  ) {
    const room = await this.roomModel
      .findOne({
        participants: {
          $all: participantIds,
          $size: participantIds.length,
        },
        ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
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
    console.log('room id', id, userId);
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

  async findWithCursorPaginate(
    queryParams: ListQueryParamsCursor,
    userId: string,
  ): Promise<Pagination<Room, CursorPaginationInfo>> {
    const { limit = 10, cursor } = queryParams;

    const query: FilterQuery<Room> = {
      newMessageAt: {
        $lt: cursor ? new Date(cursor).toISOString() : new Date().toISOString(),
      },
      participants: userId,
      status: {
        $ne: RoomStatus.DELETED,
      },
    };

    const rooms = await this.roomModel
      .find(query)
      .sort({ newMessageAt: -1 })
      .limit(limit)
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
    const pageInfo: CursorPaginationInfo = {
      endCursor: rooms[rooms.length - 1]?.newMessageAt?.toISOString(),
      hasNextPage: rooms.length === limit,
    };

    return {
      items: rooms.map((room) => ({
        ...room.toObject(),
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
        populate: {
          path: 'sender',
          select: userSelectFieldsString,
        },
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
      );
    return room;
  }

  async updateRoom(roomId: string, data: Partial<Room>) {
    const updatedRoom = await this.roomModel
      .findByIdAndUpdate(
        roomId,
        {
          ...data,
          newMessageAt: new Date().toISOString(),
        },
        {
          new: true,
        },
      )
      .populate(
        selectPopulateField<Room>(['participants']),
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
    const newRoom = await this.updateRoom(roomId, data);
    return newRoom;
  }

  async addParticipants(roomId: string, userIds: string[], userId: string) {
    const room = await this.findGroupByIdAndUserId(roomId, userId);

    if (!room) {
      throw new Error('Room not found');
    }

    const participants = await Promise.all(
      userIds.map((id) => this.usersService.findById(id)),
    );
    room.participants = [...new Set([...room.participants, ...participants])];

    await room.save();

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
    this.eventEmitter.emit(socketConfig.events.room.update, {
      roomId,
      participants: room.participants.map((p) => p._id),
      data: {
        participants: room.participants,
      },
    });
    return room.populate([
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
}
