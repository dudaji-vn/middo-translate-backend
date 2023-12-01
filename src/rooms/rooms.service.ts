import {
  BadRequestException,
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
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateRoomDto } from './dtos';
import { Room, RoomStatus } from './schemas/room.schema';
import { convertMessageRemoved } from 'src/messages/utils/convert-message-removed';
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
    if (!isGroup && participants.length !== 2) {
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
    const room = await this.findByIdAndUserId(id, userId);
    if (!room.isGroup) {
      throw new Error('Cannot leave room not group');
    }
    if (!room) {
      throw new Error('Room not found');
    }
    room.participants = room.participants.filter(
      (p) => String(p._id) !== userId,
    );
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
          select: '_id name avatar email username',
        },
      })
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'username',
        ]),
      );

    return room;
  }

  async findByIdAndUserId(id: string, userId: string, inCludeDeleted = false) {
    let room = await this.roomModel.findOne({
      _id: id,
      participants: userId,
      ...(inCludeDeleted ? {} : { status: RoomStatus.ACTIVE }),
    });
    if (!room) {
      room = await this.findByParticipantIds([id, userId]);
      console.log(room);
    }
    if (!room) {
      room = new this.roomModel();
      try {
        const participants = await Promise.all(
          [userId, id].map((id) => this.usersService.findById(id)),
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
        select: '_id name avatar email username',
      },
      {
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: '_id name avatar email username',
        },
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
          select: '_id name avatar email username',
        },
      })
      .populate(
        selectPopulateField<Room>(['participants']),
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'username',
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
          'username',
        ]),
      )
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: '_id name avatar email username',
        },
      })
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
          'username',
        ]),
      );
    return room;
  }

  async updateRoom(roomId: string, data: Partial<Room>) {
    const room = await this.findById(roomId);

    await this.roomModel.updateOne({ _id: roomId }, data);
    const updatePayload: UpdateRoomPayload = {
      roomId,
      data,
      participants: room?.participants.map((p) => p._id) || [],
    };
    this.eventEmitter.emit(socketConfig.events.room.update, {
      ...updatePayload,
    });
  }
}
