import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model, Types } from 'mongoose';
import {
  CursorPaginationInfo,
  ListQueryParamsCursor,
  Pagination,
} from 'src/common/types';
import { selectPopulateField } from 'src/common/utils';
import { socketConfig } from 'src/configs/socket.config';
import {
  NewMessagePayload,
  ReplyMessagePayload,
} from 'src/events/types/message-payload.type';
import { RoomsService } from 'src/rooms/rooms.service';
import { User, UserRelationType } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateMessageDto } from './dto';
import {
  ActionTypes,
  MediaTypes,
  Message,
  MessageStatus,
  MessageType,
  Reaction,
  SenderType,
} from './schemas/messages.schema';
import { convertMessageRemoved } from './utils/convert-message-removed';
import { NotificationService } from 'src/notifications/notifications.service';
import { envConfig } from 'src/configs/env.config';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { Room, RoomStatus } from 'src/rooms/schemas/room.schema';
import { Call } from 'src/call/schemas/call.schema';
import { PinMessage } from './schemas/pin-messages.schema';
import { convert } from 'html-to-text';
import { generateSystemMessageContent } from './utils/generate-action-message-content';
import {
  detectLanguage,
  multipleTranslate,
  translate,
} from './utils/translate';
import { logger } from 'src/common/utils/logger';
import { DefaultTag, Space } from '../help-desk/schemas/space.schema';

@Injectable()
export class MessagesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Call.name) private readonly callModel: Model<Call>,
    @InjectModel(PinMessage.name)
    private readonly pinMessageModel: Model<PinMessage>,
  ) {}

  async findById(id: string): Promise<Message> {
    const message = await this.messageModel.findById(id).populate([
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
      {
        path: 'room',
        select: selectPopulateField<Room>([
          '_id',
          'name',
          'isGroup',
          'participants',
        ]),
        populate: [
          {
            path: 'participants',
            select: selectPopulateField<User>(['_id', 'avatar', 'name']),
          },
        ],
      },
      {
        path: 'forwardOf',
        select: selectPopulateField<Message>([
          '_id',
          'content',
          'contentEnglish',
          'type',
          'media',
          'sender',
          'targetUsers',
          'reactions',
          'forwardOf',
          'room',
        ]),
        populate: [
          {
            path: 'sender',
            select: selectPopulateField<User>([
              '_id',
              'name',
              'avatar',
              'email',
              'language',
            ]),
          },
          {
            path: 'room',
            select: selectPopulateField<Room>([
              '_id',
              'name',
              'participants',
              'isGroup',
            ]),
            populate: [
              {
                path: 'participants',
                select: selectPopulateField<User>(['_id']),
              },
            ],
          },
        ],
      },
      {
        path: 'call',
        select: selectPopulateField<Call>(['endTime', '_id', 'type']),
      },
      {
        path: 'mentions',
        select: selectPopulateField<User>(['_id', 'name', 'email']),
      },
    ]);
    if (!message) {
      throw new Error('Message not found');
    }
    return message;
  }

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

    if (!room?.isGroup && room?.participants.length === 2) {
      const otherUser = room.participants.find(
        (p: any) => p._id.toString() !== user._id.toString(),
      );
      if (otherUser) {
        const relation = await this.usersService.checkRelationship(
          user._id.toString(),
          otherUser._id.toString(),
        );
        switch (relation) {
          case UserRelationType.BLOCKED:
            throw new BadRequestException('You are blocked by this user');
          case UserRelationType.BLOCKING:
            throw new BadRequestException('You are blocking this user');
          default:
            break;
        }
      }
    }

    const createdMessage = new this.messageModel();
    createdMessage.sender = user;
    createdMessage.content = createMessageDto.content || '';
    createdMessage.contentEnglish = createMessageDto.contentEnglish || '';
    createdMessage.media = createMessageDto.media || [];
    createdMessage.actions = createMessageDto.actions || [];
    createdMessage.language = createMessageDto.language || '';
    createdMessage.type = createMessageDto.type || MessageType.TEXT;
    createdMessage.action = createMessageDto.action || ActionTypes.NONE;

    if (createdMessage.content) {
      const data = await this.translateMessageInRoom({
        content: createdMessage.content,
        sourceLang: createdMessage.language,
        participants: room.participants,
        enContent: createMessageDto.enContent,
      });
      createdMessage.translations = data.translations;
      createdMessage.language = data.sourceLang;
    }

    if (createdMessage.actions && createdMessage.actions.length > 0) {
      const actionsToTranslate = createdMessage.actions.filter(
        (item) => item.data && item.data.content,
      );

      // Extract content for translation
      const contentsToTranslate = actionsToTranslate.map(
        (item) => item.data.content,
      );

      const clientParticipants =
        room?.participants && room?.participants?.length
          ? [room.participants[0]]
          : [];
      const translationTasks = contentsToTranslate.map((content) => {
        return this.translateMessageInRoom({
          content,
          participants: clientParticipants,
        })
          .then((data) => data.translations)
          .catch((error) => {
            console.error('Translation error:', error);
            return [];
          });
      });

      // Execute translation tasks concurrently
      const translations = await Promise.all(translationTasks);

      // Update actions with translations
      translations.forEach((translation, index) => {
        const item = actionsToTranslate[index];
        item.data.translations = translation;
        createdMessage.actions[createdMessage.actions.indexOf(item)] = item;
      });
    }

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

    if (createMessageDto.forwardOfId) {
      createdMessage.forwardOf = await this.findById(
        createMessageDto.forwardOfId,
      );
    }

    if (createMessageDto.mentions && createMessageDto.mentions.length > 0) {
      const mentions = createMessageDto.mentions.filter((id) =>
        Types.ObjectId.isValid(id),
      );
      if (mentions.length > 0) {
        createdMessage.mentions = await this.usersService.findManyByIds(
          mentions,
        );
      }
    }

    createdMessage.room = room;
    createdMessage.readBy = [user._id];
    createdMessage.deliveredTo = [user._id];
    if (createMessageDto.callId) {
      const call = await this.callModel.findById(createMessageDto.callId);
      if (call) createdMessage.call = call;
    }
    if (room.isHelpDesk) {
      createdMessage.senderType =
        createMessageDto.senderType || SenderType.USER;
      if (
        createMessageDto.senderType === SenderType.BOT &&
        room.space &&
        room.space.bot
      ) {
        createdMessage.sender = room.space.bot;
        createdMessage.readBy = [];
      }
      await this.roomsService.updateRoomHelpDesk(
        room._id,
        createMessageDto.senderType,
      );
    }
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
      {
        path: 'room',
        select: selectPopulateField<Room>(['_id']),
      },
    ]);

    const socketPayload: NewMessagePayload = {
      roomId: String(room._id),
      message: newMessageWithSender,
      clientTempId: createMessageDto.clientTempId,
    };
    const isUserInWaitingList = room.waitingUsers.some(
      (u: any) => u._id.toString() === user._id.toString(),
    );
    if (isUserInWaitingList) {
      await this.roomsService.accept(
        room._id,
        user._id.toString(),
        room?.status,
      );
    }
    let roomNewStatus = room.status;
    if (roomNewStatus === RoomStatus.ARCHIVED) {
      roomNewStatus = RoomStatus.ACTIVE;
    }
    if (!room?.isGroup) {
      if (isUserInWaitingList && room.waitingUsers.length == 1) {
        roomNewStatus = RoomStatus.ACTIVE;
      }
      const anotherUserId = room.waitingUsers.find(
        (u: any) => u._id.toString() !== user._id.toString(),
      )?._id;
      if (anotherUserId) {
        const anotherUser = await this.usersService.findById(anotherUserId);
        if (anotherUser.allowUnknown) {
          await this.roomsService.accept(
            room._id,
            anotherUser._id.toString(),
            room?.status,
          );
          roomNewStatus = RoomStatus.ACTIVE;
        }
      }
    }
    this.roomsService.updateRoom(String(newMessage.room._id), {
      lastMessage: newMessageWithSender,
      newMessageAt: new Date(),
      status: roomNewStatus,
      deleteFor: [],
      archiveFor: [],
    });

    this.eventEmitter.emit(socketConfig.events.message.new, socketPayload);
    if (createMessageDto.senderType !== SenderType.BOT) {
      this.sendMessageNotification(newMessageWithSender);
    }

    return newMessageWithSender;
  }

  async translate(id: string, userId: string, to: string) {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    const room = await this.roomsService.findByIdAndUserId(
      message.room._id.toString(),
      userId,
    );
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    // if (room.isHelpDesk) {
    //   throw new Error('Cannot translate in helpdesk room');
    // }
    if (message.translations && message.translations[to]) {
      return message;
    }
    const data = await multipleTranslate({
      content: message.content,
      sourceLang: message.language,
      targetLangs: [to],
    });
    message.translations = {
      ...message.translations,
      ...data,
    };
    this.update(id, {
      translations: message.translations,
    });
    return message;
  }
  // reply to message
  async reply(
    id: string,
    senderId: string,
    createMessageDto: CreateMessageDto,
  ) {
    const user = await this.usersService.findById(senderId);
    const parentMessage = await this.findById(id);

    const room = await this.roomsService.findByIdAndUserId(
      parentMessage.room._id.toString(),
      user._id.toString(),
    );

    const createdMessage = new this.messageModel();
    createdMessage.sender = user;
    createdMessage.content = createMessageDto.content || '';
    createdMessage.contentEnglish = createMessageDto.contentEnglish || '';
    createdMessage.media = createMessageDto.media || [];
    createdMessage.language = createMessageDto.language || '';
    createdMessage.type = createMessageDto.type || MessageType.TEXT;

    if (createdMessage.media.length > 0) {
      createdMessage.type = MessageType.MEDIA;
    }

    if (createdMessage.content) {
      const data = await this.translateMessageInRoom({
        content: createdMessage.content,
        sourceLang: createdMessage.language,
        participants: room.participants,
        enContent: createMessageDto.enContent,
      });
      createdMessage.translations = data.translations;
      createdMessage.language = data.sourceLang;
    }

    if (createMessageDto.mentions && createMessageDto.mentions.length > 0) {
      const mentions = createMessageDto.mentions.filter((id) =>
        Types.ObjectId.isValid(id),
      );
      if (mentions.length > 0) {
        createdMessage.mentions = await this.usersService.findManyByIds(
          mentions,
        );
      }
    }
    createdMessage.room = room;
    createdMessage.readBy = [user._id];
    createdMessage.deliveredTo = [user._id];
    createdMessage.parent = parentMessage;
    const newMessage = await createdMessage.save();
    await newMessage.populate([
      {
        path: 'sender',
        select: selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'language',
        ]),
      },
    ]);
    const socketPayload: ReplyMessagePayload = {
      replyToMessageId: id,
      message: newMessage,
      clientTempId: createMessageDto.clientTempId,
    };
    this.eventEmitter.emit(
      socketConfig.events.message.reply.new,
      socketPayload,
    );

    this.sendReplyMessageNotification(newMessage);
    await this.update(id, { hasChild: true });
    return newMessage;
  }

  // get all reply of message

  async getReplies(id: string, userId: string) {
    const message = await this.findById(id);
    const room = await this.roomsService.findByIdAndUserId(
      message.room._id.toString(),
      userId,
    );
    const query: FilterQuery<Message> = {
      room: room._id,
      parent: message._id,
      deleteFor: { $nin: [userId] },
    };

    const messages = await this.messageModel
      .find(query)
      .populate('room', selectPopulateField<Room>(['_id']))
      .populate(
        'sender',
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        'targetUsers',
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate('call', selectPopulateField<Call>(['endTime', '_id', 'type']))
      .populate('parent', selectPopulateField<Message>(['_id']))
      .populate(
        'reactions.user',
        selectPopulateField<User>([
          '_id',
          'name',
          'email',
          'avatar',
          'language',
          'username',
        ]),
      )
      .populate([
        {
          path: 'forwardOf',
          select: selectPopulateField<Message>([
            '_id',
            'content',
            'contentEnglish',
            'type',
            'media',
            'sender',
            'targetUsers',
            'reactions',
            'forwardOf',
            'room',
          ]),
          populate: [
            {
              path: 'sender',
              select: selectPopulateField<User>([
                '_id',
                'name',
                'avatar',
                'email',
                'language',
              ]),
            },
            {
              path: 'room',
              select: selectPopulateField<Room>([
                '_id',
                'name',
                'participants',
                'isGroup',
              ]),
              populate: [
                {
                  path: 'participants',
                  select: selectPopulateField<User>(['_id']),
                },
              ],
            },
          ],
        },
      ])
      .populate(
        'mentions',
        selectPopulateField<User>(['_id', 'name', 'email']),
      );

    return messages.map((message) => {
      return convertMessageRemoved(message, userId) as Message;
    });
  }

  async update(
    id: string,
    updateMessageDto: Partial<Message> & {
      enContent?: string;
      mentions?: string[];
    },
  ) {
    const message = await this.messageModel.findById(id).populate(['parent']);
    if (!message) {
      throw new Error('Message not found');
    }
    if (updateMessageDto.content) {
      const content = updateMessageDto.content;
      const enContent = updateMessageDto.enContent;
      const message = await this.findById(id);
      const room = await this.roomsService.findById(
        message.room._id.toString(),
      );
      if (!room) {
        throw new NotFoundException('Room not found');
      }
      const data = await this.translateMessageInRoom({
        content: content,
        sourceLang: updateMessageDto.language,
        participants: room.participants,
        enContent: enContent,
      });

      updateMessageDto.status = MessageStatus.EDITED;
      updateMessageDto.translations = data.translations;
      updateMessageDto.language = data.sourceLang;
      updateMessageDto.editHistory = [
        content,
        ...message.editHistory.map((item) => item),
      ];
    }
    await message.updateOne(updateMessageDto);

    this.eventEmitter.emit(socketConfig.events.message.update, {
      roomId: String(message?.room),
      message: {
        _id: message._id,
        parent: message.parent,
        ...updateMessageDto,
        editHistory: null,
      },
    });
    return message;
  }

  async sendMessageNotification(message: Message) {
    let title = envConfig.app.name;
    let body = message.sender.name;
    let featurePath = 'talk';
    const room = await this.roomsService.findById(message.room._id.toString());
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.isHelpDesk) {
      const roomWithSpace: any = await room.populate('space');
      title = `${envConfig.app.extension_name} -  ${roomWithSpace.space?.name}`;
      featurePath = `spaces/${roomWithSpace.space?._id}/conversations`;
      switch (message.action) {
        case ActionTypes.LEAVE_HELP_DESK:
          body = ` ${message.sender.name} left the conversation`;
          break;
        default:
          body = `${message.sender.name} from ${room?.fromDomain}`;
          break;
      }
    }
    const messageContent = convert(message.content, {
      selectors: [{ selector: 'a', options: { ignoreHref: true } }],
    });

    switch (message.type) {
      case MessageType.TEXT:
        if (room.isGroup) {
          body += ` sent message in ${
            room.name !== '' ? room.name : 'your group'
          }`;
        }
        // body += `: ${messageContent}`;
        break;
      case MessageType.MEDIA:
        body += ' sent media';
        if (room.isGroup) {
          body += ` in ${room.name !== '' ? room.name : 'your group'}`;
        }
        break;
      case MessageType.NOTIFICATION:
        body += ` ${messageContent}`;
        if (room.isGroup) {
          body += ` in ${room.name !== '' ? room.name : 'your group'}`;
        }
        break;
      case MessageType.ACTION:
        body += generateSystemMessageContent({
          action: message.action,
          content: messageContent,
        });
        break;
      case MessageType.CALL:
        body += ' started a call';
        if (room.isGroup) {
          body += ` in ${room.name !== '' ? room.name : 'your group'}`;
        }
        break;
      default:
        break;
    }

    let targetUserIds = room.participants.reduce((acc, participant) => {
      if (participant._id.toString() !== message.sender._id.toString()) {
        acc.push(participant._id.toString());
      }
      return acc;
    }, [] as string[]);

    const userIgnoredNotification =
      await this.notificationService.getUsersIgnoringRoom(room._id.toString());

    targetUserIds = targetUserIds.filter(
      (id) => !userIgnoredNotification.includes(id),
    );
    const link = `${envConfig.app.url}/${featurePath}/${room._id}`;
    if (message.type === MessageType.TEXT) {
      // base on targetUserIds laguage to send notification in correct language of message translations field
      const groupByLanguage = targetUserIds.reduce((acc, id) => {
        const user = room.participants.find((p) => p._id.toString() === id);
        if (user) {
          if (!acc[user.language]) {
            acc[user.language] = [];
          }
          acc[user.language].push(id);
        }
        return acc;
      }, {} as Record<string, string[]>);

      for (const language in groupByLanguage) {
        console.log('language', language);
        console.log(message.translations[language]);
        const messageContent = convert(
          message.translations[language] || message.content,
          {
            selectors: [{ selector: 'a', options: { ignoreHref: true } }],
          },
        );
        this.notificationService.sendNotification({
          userIds: groupByLanguage[language],
          title,
          body: body + `: ${messageContent}`,
          roomId: room._id.toString(),
          link,
          messageId: message._id.toString(),
          message: {
            roomId: room._id.toString(),
            messageId: message._id.toString(),
          },
        });
      }
      return;
    }
    this.notificationService.sendNotification({
      userIds: targetUserIds,
      title,
      body,
      roomId: room._id.toString(),
      link,
      messageId: message._id.toString(),
      message: {
        roomId: room._id.toString(),
        messageId: message._id.toString(),
      },
    });
  }
  async sendReplyMessageNotification(message: Message) {
    const title = envConfig.app.name;
    let body = message.sender.name + ' replied in a discussion';
    const parentMessage = await this.findById(message.parent._id.toString());
    const messageContent = convert(message.content);
    switch (message.type) {
      case MessageType.TEXT:
        body += `: ${messageContent}`;
        break;
      case MessageType.MEDIA:
        body += ' sent media';
        break;
      case MessageType.NOTIFICATION:
        body += ` ${messageContent}`;
        break;
      case MessageType.ACTION:
        body += generateSystemMessageContent({
          action: message.action,
          content: messageContent,
        });
        break;
      default:
        break;
    }

    const roomId = message.room._id.toString();
    const allReplies = await this.getReplies(
      message.parent._id.toString(),
      message.sender._id.toString(),
    );

    let targetUserIds = allReplies.reduce((acc, reply) => {
      acc.push(reply.sender._id.toString());
      return acc;
    }, [] as string[]);

    targetUserIds.push(parentMessage.sender._id.toString());

    // push all mentions in replies
    allReplies.forEach((reply) => {
      targetUserIds.push(
        ...reply.mentions.map((mention) => mention._id.toString()),
      );
    });
    // push all mentions in parent message
    parentMessage.mentions.forEach((mention) => {
      targetUserIds.push(mention._id.toString());
    });

    // push all mentions in current message
    targetUserIds.push(
      ...message.mentions.map((mention) => mention._id.toString()),
    );

    // unique targetUserIds
    targetUserIds = [...new Set(targetUserIds)];

    targetUserIds = targetUserIds.filter(
      (id) => id !== message.sender._id.toString(),
    );
    logger.info('targetUserIds', targetUserIds);
    const userIgnoredNotification =
      await this.notificationService.getUsersIgnoringRoom(roomId);

    targetUserIds = targetUserIds.filter(
      (id) => !userIgnoredNotification.includes(id),
    );

    const link = `${envConfig.app.url}/talk/${roomId}?r_tab=discussion&ms_id=${message.parent._id}`;
    this.notificationService.sendNotification({
      userIds: targetUserIds,
      title,
      body,
      roomId,
      link,
      messageId: message._id.toString(),
      message: {
        roomId,
        messageId: message._id.toString(),
        parentMessageId: message.parent._id.toString(),
      },
    });
  }

  async findByRoomIdWithCursorPaginate(
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
      isForwarded: { $ne: true },
      parent: { $exists: false },
    };

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('room', selectPopulateField<Room>(['_id']))
      .populate(
        'sender',
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate(
        'targetUsers',
        selectPopulateField<User>([
          '_id',
          'name',
          'avatar',
          'email',
          'language',
        ]),
      )
      .populate('call')
      .populate(
        'reactions.user',
        selectPopulateField<User>([
          '_id',
          'name',
          'email',
          'avatar',
          'language',
          'username',
        ]),
      )
      .populate([
        {
          path: 'forwardOf',
          select: selectPopulateField<Message>([
            '_id',
            'content',
            'contentEnglish',
            'type',
            'media',
            'sender',
            'targetUsers',
            'reactions',
            'forwardOf',
            'room',
          ]),
          populate: [
            {
              path: 'sender',
              select: selectPopulateField<User>([
                '_id',
                'name',
                'avatar',
                'email',
                'language',
              ]),
            },
            {
              path: 'room',
              select: selectPopulateField<Room>([
                '_id',
                'name',
                'participants',
                'isGroup',
              ]),
              populate: [
                {
                  path: 'participants',
                  select: selectPopulateField<User>(['_id']),
                },
              ],
            },
          ],
        },
      ])
      .populate(
        'mentions',
        selectPopulateField<User>(['_id', 'name', 'email']),
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

  async createAction({
    roomId,
    senderId,
    targetUserIds = [],
    action,
    content,
  }: {
    roomId: string;
    senderId: string;
    targetUserIds?: string[];
    action: ActionTypes;
    content?: string;
  }): Promise<Message> {
    const message = await this.create(
      {
        roomId,
        content,
        type: MessageType.ACTION,
        clientTempId: '',
        media: [],
        contentEnglish: '',
        targetUserIds,
        action,
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

  async deleteAllInRoom(roomId: string, userId: string): Promise<void> {
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

  async seen(id: string, userId: string): Promise<void> {
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
      )
      .populate('parent');

    if (!message) {
      throw new Error('Message not found');
    }
    await this.roomsService.updateReadByLastMessageInRoom(
      message.room._id,
      userId,
    );
    this.eventEmitter.emit(socketConfig.events.message.update, {
      roomId: String(message?.room),
      message: {
        _id: message._id,
        parent: message.parent,
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

  async checkSeen(id: string, userId: string): Promise<boolean> {
    const message = await this.messageModel.exists({
      _id: id,
      readBy: userId,
    });
    return !!message;
  }

  async react(id: string, userId: string, emoji: string) {
    const message = await this.messageModel
      .findById(id)
      .populate(
        'reactions.user',
        selectPopulateField<User>([
          '_id',
          'name',
          'email',
          'avatar',
          'language',
          'username',
        ]),
      )
      .populate('room', selectPopulateField<Room>(['_id', 'isHelpDesk']))
      .populate('parent');
    if (!message) {
      throw new Error('Message not found');
    }
    const reactions = message.reactions;

    // 3 cases here
    // 1. user already reacted
    // 2. user not reacted with same reaction
    // 3. user reacted with another reaction
    const user = await this.usersService.findById(userId);
    const reaction = reactions.find((r) => r.user._id.toString() === userId);
    if (reaction) {
      // case 1
      if (reaction.emoji === emoji) {
        // case 1
        message.reactions = reactions.filter(
          (r) => r.user._id.toString() !== userId,
        );
      } else {
        // case 3
        reaction.emoji = emoji;
      }
    } else {
      // case 2
      const newReaction: Reaction = {
        user,
        emoji,
      } as Reaction;
      newReaction.user = user;
      newReaction.emoji = emoji;
      message.reactions.push(newReaction);
      if (message.sender._id.toString() !== userId) {
        const link = `${envConfig.app.url}/${
          message.room.isHelpDesk ? 'business/conversations' : 'talk'
        }/${message.room._id}`;
        this.notificationService.sendNotification({
          userIds: [message.sender._id.toString()],
          title: envConfig.app.name,
          body: `${user.name} reacted to your message`,
          roomId: message.room._id.toString(),
          link,
          messageId: message._id.toString(),
          message: {
            roomId: message.room._id.toString(),
            messageId: message._id.toString(),
          },
        });
      }
    }
    await message.save();
    this.eventEmitter.emit(socketConfig.events.message.update, {
      roomId: String(message?.room._id),
      message: {
        _id: message._id,
        parent: message.parent,
        reactions: message.reactions,
      },
    });
  }

  async forward(
    forwardedId: string,
    senderId: string,
    data: ForwardMessageDto,
  ) {
    const { roomIds, message } = data;

    let forwardMessage = await this.findById(forwardedId);
    if (!forwardMessage) {
      throw new Error('Message not found');
    }

    if (!forwardMessage.content && forwardMessage?.forwardOf) {
      forwardMessage = forwardMessage.forwardOf;
    }

    const rooms = await Promise.all(
      roomIds.map((id) =>
        this.roomsService.findOrCreateByIdAndUserId(id.toString(), senderId),
      ),
    );
    await Promise.all(
      rooms.map(async (room) => {
        const cloneForwardMessage = new this.messageModel();
        cloneForwardMessage.sender = forwardMessage.sender;
        cloneForwardMessage.content = forwardMessage.content;
        cloneForwardMessage.contentEnglish = forwardMessage.contentEnglish;
        cloneForwardMessage.media = forwardMessage.media;
        cloneForwardMessage.language = forwardMessage.language;
        cloneForwardMessage.type = forwardMessage.type;
        cloneForwardMessage.room = forwardMessage.room;
        cloneForwardMessage.isForwarded = true;
        const savedClone = await cloneForwardMessage.save();
        this.create(
          {
            ...message,
            roomId: room._id.toString(),
            forwardOfId: savedClone._id.toString(),
          },
          senderId,
          true,
        );
      }),
    );
  }

  async findByCallId(callId: string) {
    const message = await this.messageModel.findOne({ call: callId });
    return message;
  }

  async pin(messageId: string, userId: string) {
    const message = await this.findById(messageId);
    const user = await this.usersService.findById(userId);
    const room = await this.roomsService.findByIdAndUserId(
      message.room._id.toString(),
      userId,
    );
    const pinMessage = await this.pinMessageModel.findOne({
      message: messageId,
    });
    const isPinned = !!pinMessage;
    if (isPinned) {
      await pinMessage.deleteOne();
      this.createAction({
        roomId: message.room._id.toString(),
        senderId: userId,
        action: ActionTypes.UNPIN_MESSAGE,
      });
    } else {
      const newPinMessage = new this.pinMessageModel();
      this.createAction({
        roomId: message.room._id.toString(),
        senderId: userId,
        action: ActionTypes.PIN_MESSAGE,
      });
      newPinMessage.message = message;
      newPinMessage.pinnedBy = user;
      newPinMessage.room = room;
      await newPinMessage.save();
    }
    this.eventEmitter.emit(socketConfig.events.message.pin, {
      roomId: room._id.toString(),
    });
    return !isPinned;
  }

  async getPinnedMessages(roomId: string, userId: string) {
    const room = await this.roomsService.findByIdAndUserId(roomId, userId);
    const pinMessages = await this.pinMessageModel
      .find({
        room: room._id,
      })
      .populate([
        {
          path: 'message',
          populate: [
            {
              path: 'sender',
              select: selectPopulateField<User>([
                '_id',
                'name',
                'avatar',
                'email',
                'language',
              ]),
            },
            {
              path: 'room',
              select: selectPopulateField<Room>([
                '_id',
                'name',
                'participants',
                'isGroup',
              ]),
              populate: [
                {
                  path: 'participants',
                  select: selectPopulateField<User>(['_id']),
                },
              ],
            },
            {
              path: 'call',
            },
            {
              path: 'mentions',
              select: selectPopulateField<User>(['_id', 'name', 'email']),
            },
          ],
        },
        {
          path: 'pinnedBy',
          select: selectPopulateField<User>([
            '_id',
            'name',
            'avatar',
            'email',
            'language',
          ]),
        },
      ])
      .sort({ createdAt: -1 });
    const pinMessagesWithRemoved = pinMessages.map((pinMessage) => {
      const message = convertMessageRemoved(pinMessage.message, userId);
      return {
        ...pinMessage.toJSON(),
        message: message,
      };
    });
    return pinMessagesWithRemoved;
  }

  async initHelpDeskConversation(
    createMessageDto: CreateMessageDto,
    senderId: string,
  ): Promise<Message> {
    const user = await this.usersService.findById(senderId);

    const room = await this.roomsService.findByIdAndUserId(
      createMessageDto.roomId,
      user._id.toString(),
    );

    const newMessage = await this.messageModel.findOneAndUpdate(
      { room: room._id },
      {
        content: createMessageDto.content,
        contentEnglish: createMessageDto.contentEnglish,
        deliveredTo: [user._id],
        sender: senderId,
      },
      {
        upsert: true,
        new: true,
      },
    );
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
    this.roomsService.updateRoom(createMessageDto.roomId, {
      lastMessage: newMessageWithSender,
      newMessageAt: new Date(),
    });
    return newMessage;
  }
  async endConversation(roomId: string, senderId: string) {
    const room = await this.roomsService.findByIdAndUserId(roomId, senderId);
    const space = room.space as Space;
    if (!space || !space.tags) {
      throw new BadRequestException(`Space has no tag`);
    }

    const tag = space.tags.find((tag) => tag.name === DefaultTag.COMPLETED);
    if (!tag) {
      throw new BadRequestException(`Tag not exist in space`);
    }

    await this.roomsService.updateRoom(room._id.toString(), {
      tag: new mongoose.Types.ObjectId(tag._id) as any,
    });
    await this.createAction({
      roomId: roomId,
      senderId: senderId,
      action: ActionTypes.LEAVE_HELP_DESK,
    });
    return null;
  }
  search({
    query,
    params,
    select,
  }: {
    query: FilterQuery<Message>;
    params: {
      limit: number;
      userId: string;
      q: string;
    };
    select?: string;
  }) {
    const translationsKey = `translations.en`;
    const { limit, userId, q } = params;
    return this.messageModel
      .find({
        removedFor: { $nin: userId },
        isForwarded: { $ne: true },
        parent: { $exists: false },
        $or: [
          {
            [translationsKey]: { $regex: q, $options: 'i' },
          },
          {
            content: { $regex: q, $options: 'i' },
          },
        ],
        ...query,
      })
      .limit(limit)
      .select(
        select
          ? select
          : '_id sender content translations room createdAt updatedAt',
      )
      .populate([
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
          path: 'room',
          select: selectPopulateField<Room>([
            '_id',
            'name',
            'participants',
            'isGroup',
          ]),
          populate: [
            {
              path: 'participants',
              select: selectPopulateField<User>(['_id']),
            },
          ],
        },
      ])

      .lean();
  }
  translateMessageInRoom = async ({
    content,
    participants,
    enContent,
    sourceLang,
  }: {
    participants: User[];
    enContent?: string;
    content: string;
    sourceLang?: string;
  }) => {
    // Get all languages in the room
    logger.info('Start ->');
    const translations: Record<string, string> = {};
    let targetLangs = participants.map((p) => p.language);
    if (!sourceLang) {
      logger.info('detect language');
      sourceLang = await detectLanguage(content);
      logger.info('sourceLang', sourceLang);
    }
    translations[sourceLang] = content;

    if (sourceLang !== 'en') {
      if (!enContent) {
        // Translate content to English first
        logger.info('translate content to English');
        enContent = await translate(content, sourceLang, 'en');
      }
      translations.en = enContent;
    }
    logger.info('1', JSON.stringify(translations));
    // filter out sourceLang and en
    targetLangs = targetLangs.filter(
      (lang) => lang !== sourceLang && lang !== 'en',
    );

    logger.info('filter out sourceLang and en', JSON.stringify(targetLangs));
    if (targetLangs.length !== 0) {
      // Translate content
      logger.info('translate content');
      const data = await multipleTranslate({
        content: translations.en,
        sourceLang: 'en',
        targetLangs,
      });
      logger.info(
        '2',
        JSON.stringify({
          ...translations,
          ...data,
        }),
      );
      return {
        translations: {
          ...translations,
          ...data,
        },
        sourceLang,
      };
    }
    return {
      translations,
      sourceLang,
    };
  };
}
