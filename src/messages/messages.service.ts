import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  CursorPaginationInfo,
  ListQueryParamsCursor,
  Pagination,
} from 'src/common/types';
import { selectPopulateField } from 'src/common/utils';
import { socketConfig } from 'src/configs/socket.config';
import { NewMessagePayload } from 'src/events/types/message-payload.type';
import { RoomsService } from 'src/rooms/rooms.service';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateMessageDto } from './dto';
import { MediaTypes, Message, MessageType } from './schemas/messages.schema';
import { convertMessageRemoved } from './utils/convert-message-removed';

@Injectable()
export class MessagesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    senderId: string,
    allowSendIfNotParticipant = false,
  ): Promise<Message> {
    const user = await this.usersService.findById(senderId);
    let room: any;
    if (allowSendIfNotParticipant) {
      room = await this.roomsService.findById(createMessageDto.roomId);
    } else {
      room = await this.roomsService.findByIdAndUserId(
        createMessageDto.roomId,
        user._id.toString(),
      );
    }
    const createdMessage = new this.messageModel();
    createdMessage.sender = user;
    createdMessage.content = createMessageDto.content || '';
    createdMessage.contentEnglish = createMessageDto.contentEnglish || '';
    createdMessage.media = createMessageDto.media || [];
    createdMessage.type = createMessageDto.type || MessageType.TEXT;
    if (createdMessage.media.length > 0) {
      createdMessage.type = MessageType.MEDIA;
    }

    if (
      createMessageDto?.targetUserIds &&
      createMessageDto.targetUserIds.length > 0
    ) {
      createdMessage.targetUsers = await this.usersService.findManyByIds(
        createMessageDto.targetUserIds,
      );
    }

    createdMessage.room = room;
    createdMessage.readBy = [user._id];
    createdMessage.deliveredTo = [user._id];
    const newMessage = await createdMessage.save();

    const newMessageWithSender = await newMessage.populate([
      {
        path: 'sender',
        select: selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'language',
        ]),
      },
      {
        path: 'targetUsers',
        select: selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'language',
        ]),
      },
    ]);

    const socketPayload: NewMessagePayload = {
      roomId: String(room._id),
      message: newMessageWithSender,
      clientTempId: createMessageDto.clientTempId,
    };
    this.roomsService.updateRoom(String(newMessage.room._id), {
      lastMessage: newMessageWithSender,
      newMessageAt: new Date(),
    });
    this.eventEmitter.emit(socketConfig.events.message.new, socketPayload);
    return newMessageWithSender;
  }

  async findMessagesByRoomIdWithCursorPaginate(
    roomId: string,
    userId: string,
    params: ListQueryParamsCursor,
  ): Promise<Pagination<Message, CursorPaginationInfo>> {
    let { cursor = new this.messageModel()._id, limit = 10 } = params;

    if (!cursor) cursor = new this.messageModel()._id;
    if (!limit) limit = 10;

    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    const query: FilterQuery<Message> = {
      room: room._id,
      _id: { $lt: cursor },
      deleteFor: { $nin: [userId] },
    };

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate(
        'sender',
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      )
      .populate(
        'targetUsers',
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );

    return {
      items: messages.map((message) => {
        return convertMessageRemoved(message, userId) as Message;
      }),
      pageInfo: {
        endCursor:
          messages.length > 0 ? String(messages[messages.length - 1]._id) : '',
        hasNextPage: messages.length === limit,
      },
    };
  }

  async remove(
    messageId: string,
    userId: string,
    removeType: 'me' | 'all' = 'me',
  ): Promise<Message> {
    const message = await this.messageModel
      .findById(messageId)
      .populate(
        'sender',
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );

    if (!message) {
      throw new Error('Message not found');
    }
    const room = await this.roomsService.findByIdAndUserId(
      message.room._id.toString(),
      userId,
    );

    if (removeType === 'me') {
      message.removedFor = [
        ...message.removedFor.map((id) => id.toString()),
        userId,
      ];
    } else {
      const isOwner = message.sender._id.toString() === userId;
      if (!isOwner) {
        throw new Error('You are not owner of this message');
      }
      message.removedFor = room.participants.map((p) => p._id);
    }
    await message.save();
    if (room.lastMessage?._id.toString() === message._id.toString()) {
      this.roomsService.updateRoom(String(room._id), {
        lastMessage: message,
      });
    }

    this.eventEmitter.emit(socketConfig.events.message.remove, {
      roomId: String(room._id),
      message: convertMessageRemoved(message, userId),
    });

    return message;
  }

  async createSystemMessage(
    roomId: string,
    content: string,
    senderId: string,
  ): Promise<Message> {
    const message = await this.create(
      {
        roomId,
        content,
        type: MessageType.NOTIFICATION,
        clientTempId: '',
        media: [],
        contentEnglish: '',
      },
      senderId,
      true,
    );
    return message;
  }
  async createActionMessage(
    roomId: string,
    senderId: string,
    targetUserIds: string[],
    action: 'addToGroup' | 'removeFromGroup',
  ): Promise<Message> {
    let content = '';
    switch (action) {
      case 'addToGroup':
        content = 'added';
        break;
      case 'removeFromGroup':
        content = 'removed';
        break;
      default:
        break;
    }
    const message = await this.create(
      {
        roomId,
        content,
        type: MessageType.ACTION,
        clientTempId: '',
        media: [],
        contentEnglish: '',
        targetUserIds,
      },
      senderId,
      true,
    );
    return message;
  }

  async findMediaWithPagination(
    roomId: string,
    userId: string,
    params: ListQueryParamsCursor,
  ): Promise<Pagination<Message, CursorPaginationInfo>> {
    const { cursor = new this.messageModel()._id, limit = 10 } = params;

    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    const query: FilterQuery<Message> = {
      room: room._id,
      _id: { $lt: cursor },
      type: MessageType.MEDIA,
      'media.type': { $in: [MediaTypes.IMAGE, MediaTypes.VIDEO] },
      removedFor: { $nin: [userId] },
      deleteFor: { $nin: [userId] },
    };

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit);
    return {
      items: messages,
      pageInfo: {
        endCursor:
          messages.length > 0 ? String(messages[messages.length - 1]._id) : '',
        hasNextPage: messages.length === limit,
      },
    };
  }

  async findFilesWithPagination(
    roomId: string,
    userId: string,
    params: ListQueryParamsCursor,
  ): Promise<Pagination<Message, CursorPaginationInfo>> {
    const { cursor = new this.messageModel()._id, limit = 10 } = params;

    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    const query: FilterQuery<Message> = {
      room: room._id,
      _id: { $lt: cursor },
      type: MessageType.MEDIA,
      'media.type': { $in: [MediaTypes.DOCUMENT] },
      removedFor: { $nin: [userId] },
      deleteFor: { $nin: [userId] },
    };

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit);
    return {
      items: messages,
      pageInfo: {
        endCursor:
          messages.length > 0 ? String(messages[messages.length - 1]._id) : '',
        hasNextPage: messages.length === limit,
      },
    };
  }

  async deleteAllMessagesInRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    await this.messageModel.updateMany(
      { room: room._id },
      { $push: { deleteFor: userId } },
    );
  }

  async getCloudCount(
    roomId: string,
    userId: string,
  ): Promise<{
    count: number;
    mediaCount: number;
    fileCount: number;
  }> {
    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    const query: FilterQuery<Message> = {
      room: room._id,
      type: MessageType.MEDIA,
      removedFor: { $nin: [userId] },
      deleteFor: { $nin: [userId] },
    };
    const messages = await this.messageModel.find(query).select('media');
    let count = 0;
    messages.forEach((message) => {
      count += message.media.length;
    });
    let mediaCount = 0;
    let fileCount = 0;
    messages.forEach((message) => {
      if (
        message.media[0].type === MediaTypes.IMAGE ||
        message.media[0].type === MediaTypes.VIDEO
      ) {
        mediaCount += message.media.length;
      } else if (message.media[0].type === MediaTypes.DOCUMENT) {
        fileCount += message.media.length;
      }
    });
    return {
      count,
      mediaCount,
      fileCount,
    };
  }

  async seenMessage(id: string, userId: string): Promise<void> {
    const message = await this.messageModel
      .findByIdAndUpdate(
        id,
        {
          $addToSet: { readBy: userId },
        },
        { new: true },
      )
      .populate(
        'sender',
        selectPopulateField<User>(['_id', 'name', 'avatar', 'language']),
      );

    if (!message) {
      throw new Error('Message not found');
    }

    this.eventEmitter.emit(socketConfig.events.message.update, {
      roomId: String(message?.room),
      message: {
        _id: message._id,
        readBy: message.readBy,
      },
    });
    const room = await this.roomsService.findById(message.room._id.toString());
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.lastMessage?._id.toString() === message._id.toString()) {
      this.roomsService.updateRoom(String(message.room._id), {
        lastMessage: message,
      });
    }
  }
}
