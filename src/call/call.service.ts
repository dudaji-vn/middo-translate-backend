import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RoomsService } from 'src/rooms/rooms.service';
import { Call } from './schemas/call.schema';
import { Model } from 'mongoose';
import { STATUS } from './constants/call-status';
import { CALL_TYPE, JOIN_TYPE } from './constants/call-type';
import { MessagesService } from 'src/messages/messages.service';
import { MessageType } from 'src/messages/schemas/messages.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { socketConfig } from 'src/configs/socket.config';
@Injectable()
export class CallService {
  constructor(
    private roomService: RoomsService,
    private messageService: MessagesService,
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
        return {
          status: STATUS.JOIN_SUCCESS,
          call: call,
          room: room,
          type: JOIN_TYPE.JOIN_ROOM,
        };
      }
      let roomName = '';
      if (room) {
        if (room.name) roomName = room.name;
        else if (room.participants.length < 3) {
          const participants = room.participants;
          participants.forEach((participant) => {
            roomName += participant.name + ', ';
          });
          roomName = roomName.slice(0, -2);
        } else {
          const participants = room.participants;
          roomName = participants[0].name + ', ' + participants[1].name;
          roomName += ' and ' + (participants.length - 2) + ' others';
        }
      }
      const newCall = {
        roomId: payload.roomId,
        name: roomName,
        avatar: room?.avatar,
        createdBy: payload.id,
        type: room.participants.length > 2 ? CALL_TYPE.GROUP : CALL_TYPE.DIRECT,
      };
      const newCallObj = await this.callModel.create(newCall);
      this.messageService.create(
        {
          roomId: payload.roomId,
          type: MessageType.CALL,
          media: [],
          callId: newCallObj._id.toString(),
          clientTempId: '',
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
      return { status: 'SERVER_ERROR' };
    }
  }
  async getCallInfo(payload: { roomId: string }) {
    try {
      const call = await this.callModel.findOne({
        roomId: payload.roomId,
        endTime: null,
      });
      if (!call) {
        return { status: STATUS.MEEING_NOT_FOUND };
      }
      return { status: STATUS.MEETING_STARTED, call: call };
    } catch (error) {
      return { status: 'SERVER_ERROR' };
    }
  }
  async endCall(roomId: string) {
    try {
      if (!roomId) return;
      const call = await this.callModel.findById(roomId);
      if (!call) {
        return;
      }
      call.endTime = new Date();
      const newCall = await call.save();
      console.log('newCall', newCall);
      this.eventEmitter.emit(socketConfig.events.call.update, newCall);
    } catch (error) {
      return { status: 'SERVER_ERROR' };
    }
  }
  async checkIsHaveMeeting(roomId: string) {
    try {
      const call = await this.callModel.findOne({
        roomId: roomId,
        endTime: null,
      });
      if (!call) {
        return { status: STATUS.MEEING_NOT_FOUND };
      }
      return { status: STATUS.MEETING_STARTED };
    } catch (error) {
      return { status: 'SERVER_ERROR' };
    }
  }

  async findById(id: string) {
    return await this.callModel.findById(id);
  }
}
