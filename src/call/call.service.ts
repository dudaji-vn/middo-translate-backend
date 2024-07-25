import { CallSchema } from 'src/call/schemas/call.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RoomsService } from 'src/rooms/rooms.service';
import { Call } from './schemas/call.schema';
import { Model } from 'mongoose';
import { STATUS } from './constants/call-status';
import { CALL_TYPE, JOIN_TYPE } from './constants/call-type';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType, SenderType } from 'src/messages/schemas/messages.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { socketConfig } from 'src/configs/socket.config';
import { logger } from 'src/common/utils/logger';
import { UsersService } from 'src/users/users.service';
import { Space } from 'src/help-desk/schemas/space.schema';
import { UserJoinDto } from './dto/user-join.dto';
import { selectPopulateField } from 'src/common/utils';
import { Room } from 'src/rooms/schemas/room.schema';
import { JwtService } from '@nestjs/jwt';
import { envConfig } from 'src/configs/env.config';
@Injectable()
export class CallService {
  constructor(
    private roomService: RoomsService,
    private readonly jwtService: JwtService,
    private messageService: MessagesService,
    private userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Call.name) private readonly callModel: Model<Call>,
  ) {}
  async joinVideoCallRoom(payload: { id: string; roomId: string }) {
    try {
      const room = await this.roomService.findById(payload.roomId);
      if (!room) {
        return { status: STATUS.ROOM_NOT_FOUND };
      }
      const isUserInRoom = room.participants.some(
        (p) => p._id.toString() === payload.id,
      );
      if (!isUserInRoom) {
        return { status: STATUS.USER_NOT_IN_ROOM };
      }
      const call = await this.callModel.findOne({
        roomId: payload.roomId,
        endTime: null,
      });
      if (call) {
        const newCall = await this.callModel.findByIdAndUpdate(
          call._id,
          {
            $addToSet: { participants: payload.id },
          },
          { new: true },
        );
        const message = await this.messageService.getMessageByCallId(call._id.toString());
        this.eventEmitter.emit(socketConfig.events.message.update, {
          roomId: payload.roomId,
          message: message
        });
        return {
          status: STATUS.JOIN_SUCCESS,
          call: newCall,
          room: room,
          type: JOIN_TYPE.JOIN_ROOM,
        };
      }
      let roomName = '';
      if (room) {
        if (room.name) roomName = room.name;
        else if(room.isHelpDesk) {
          let space = room.space as Space;
          roomName =  space?.name;
        }
        else if (room.participants.length < 3) {
          const participants = room.participants;
          participants.forEach((participant, index) => {
            roomName += participant.name + ', ';
          });
          roomName = roomName.slice(0, -2);
        } else {
          const participants = room.participants;
          participants.forEach((participant, index) => {
            if (index !== participants.length - 1)
              roomName += participant.name + ', ';
            else roomName += participant.name;
          });
        }
      }
      let type = CALL_TYPE.DIRECT;
      if (room.isHelpDesk) {
        type = CALL_TYPE.HELP_DESK;
      } else if (room.isGroup) {
        type = CALL_TYPE.GROUP;
      }
      if (room.isAnonymous) {
        type = CALL_TYPE.ANONYMOUS;
      }
      const newCall = {
        roomId: payload.roomId,
        name: roomName,
        avatar: room?.avatar,
        createdBy: payload.id,
        type,
        participants: [payload.id]
      };
      const newCallObj = await this.callModel.create(newCall);
      this.messageService.create(
        {
          roomId: payload.roomId,
          type: MessageType.CALL,
          media: [],
          callId: newCallObj._id.toString(),
          clientTempId: '',
          senderType: SenderType.ANONYMOUS
        },
        payload.id,
      );
      return {
        status: STATUS.JOIN_SUCCESS,
        call: newCallObj,
        room: room,
        type: JOIN_TYPE.NEW_CALL,
      };
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 90: ${error['message']}`,
        '',
        CallService.name,
      );
      return { status: 'SERVER_ERROR' };
    }
  }
  async joinAnonymousVideoCall(userId: string) {
    const room = await this.roomService.createAnonymousRoom(
      userId,
      'Instant Call',
    );
    return await this.joinVideoCallRoom({
      id: userId,
      roomId: room._id.toString(),
    });
  }
  async getCallInfo(payload: { roomId: string }) {
    try {
      const call = await this.callModel.findOne({
        roomId: payload.roomId,
        endTime: null,
      });
      if (!call) {
        return { status: STATUS.MEETING_NOT_FOUND };
      }
      return { status: STATUS.MEETING_STARTED, call: call };
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 109: ${error['message']}`,
        '',
        CallService.name,
      );
      return { status: 'SERVER_ERROR' };
    }
  }
  async callStart(payload: { callId: string; time: Date }) {
    try {
      const call = await this.callModel.findById(payload.callId);
      if (!call) return;
      call.startTime = payload.time;
      const newCall = await call.save();
      logger.info(`start call ${JSON.stringify(newCall)}`, CallService.name);
    } catch (error) {
      logger.error(`SERVER_ERROR : ${error['message']}`, '', CallService.name);
    }
  }

  async endCall(callId: string) {
    try {
      if (!callId) return;
      const call = await this.callModel.findById(callId).populate('roomId', selectPopulateField<Room>(['_id']));
      if (!call) return;
      if (call?.type == CALL_TYPE.ANONYMOUS) { // DELETE ROOM, CALL and All message of room
        await this.roomService.forgeDeleteRoomAndUserInRoom(call.roomId?._id?.toString());
        await this.messageService.forgeDeleteMessageByRoomId(call.roomId?._id?.toString());
        await this.callModel.findByIdAndDelete(callId);
        return;
      }
      call.endTime = new Date();
      const newCall = await call.save();
      logger.info(`end call ${JSON.stringify(newCall)}`, CallService.name);
      this.eventEmitter.emit(socketConfig.events.call.update, newCall);
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 119: ${error['message']}`,
        '',
        CallService.name,
      );
    }
  }
  async checkIsHaveMeeting(roomId: string) {
    try {
      const call = await this.callModel.findOne({
        roomId: roomId,
        endTime: null,
      });
      if (!call) {
        return { status: STATUS.MEETING_NOT_FOUND };
      }
      return { status: STATUS.MEETING_STARTED };
    } catch (error) {
      logger.error(
        `SERVER_ERROR in line 138: ${error['message']}`,
        '',
        CallService.name,
      );
      return { status: 'SERVER_ERROR' };
    }
  }

  async findById(id: string) {
    return await this.callModel.findById(id);
  }

  async getHelpDeskCallData(payload: { roomId: string; userId: string }) {
    try {
      const room = await this.roomService.findById(payload.roomId);
      if (!room) {
        return { status: STATUS.ROOM_NOT_FOUND };
      }
      if (!room.isHelpDesk) return { status: STATUS.MEETING_NOT_FOUND };
      const isUserInRoom = room.participants.some(
        (p) => p._id.toString() === payload.userId,
      );
      if (!isUserInRoom) {
        return { status: STATUS.USER_NOT_IN_ROOM };
      }
      const call = await this.callModel.findOne({
        roomId: payload.roomId,
        endTime: null,
      });
      const user = await this.userService.findById(payload.userId);
      if (!call || !user) {
        return { status: STATUS.MEETING_NOT_FOUND };
      }
      return { status: STATUS.MEETING_STARTED, call: call, user };
    } catch (error) {
      return { status: STATUS.USER_NOT_IN_ROOM };
    }
  }
  async createUserAndJoinCall(payload: UserJoinDto) {
    const { name, language, callId } = payload;
    const user = await this.userService.createAnonymousUser(name, language);
    const call = await this.callModel.findOne({
      _id: callId,
      endTime: null,
    });
    if (!call) {
      return { status: STATUS.CALL_NOT_FOUND };
    }
    await this.roomService.addAnonymousParticipant(
      call.roomId.toString(),
      user._id.toString(),
    );
    const token = await this.jwtService.signAsync({
      id: user._id.toString(),
    }, {
      secret: envConfig.jwt.accessToken.secret,
      expiresIn: envConfig.jwt.accessToken.expiresIn,
    });
    return {
      user,
      call,
      token
    };
  }
  async loggedUserAndJoinAnonymousCall(userId: string, callId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      return { status: STATUS.USER_NOT_IN_ROOM };
    }
    const call = await this.callModel.findOne({
      _id: callId,
      endTime: null,
    });
    if (!call) {
      return { status: STATUS.CALL_NOT_FOUND };
    }
    await this.roomService.addAnonymousParticipant(
      call.roomId.toString(),
      user._id.toString(),
    );
    return {
      call,
    };
  }
  async getCallById(callId: string) {
    return await this.callModel.findOne({
      _id: callId,
      endTime: null,
    });
  }

  async getAnonymousCallById(callId: string) {
    return await this.callModel.findOne({
      _id: callId,
      type: CALL_TYPE.ANONYMOUS,
      endTime: null,
    });
  }
}
