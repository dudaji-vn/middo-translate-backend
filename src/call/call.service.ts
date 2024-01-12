import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RoomsService } from 'src/rooms/rooms.service';
import { Call } from './schemas/call.schema';
import { Model } from 'mongoose';
import { STATUS } from './constants/call-status';
import { CALL_TYPE } from './constants/call-type';
@Injectable()
export class CallService {
  constructor(
    private roomService: RoomsService,
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
          type: CALL_TYPE.JOIN_ROOM,
        };
      }
      let roomName = '';
      if (room) {
        if (room.name) roomName = room.name;
        else {
          const participants = room.participants;
          participants.forEach((participant) => {
            roomName += participant.name + ', ';
          });
          roomName = roomName.slice(0, -2);
        }
      }
      const newCall = {
        roomId: payload.roomId,
        name: roomName,
        avatar: room?.avatar,
      };
      const newCallObj = await this.callModel.create(newCall);
      return {
        status: STATUS.JOIN_SUCCESS,
        call: newCallObj,
        room: room,
        type: CALL_TYPE.NEW_CALL,
      };
    } catch (error) {
      return { status: 'SERVER_ERROR' };
    }
  }
  async getCallInfo(payload: { slug: string; userId: string }) {
    try {
      const call = await this.callModel.findOne({ slug: payload.slug });
      if (!call) {
        return { status: STATUS.MEEING_NOT_FOUND };
      }
      if (call.endTime) {
        return { status: STATUS.MEETING_END };
      }
      const room = await this.roomService.findById(call.roomId.toString());
      if (!room) {
        return { status: STATUS.ROOM_NOT_FOUND };
      }
      const isUserInRoom = room.participants.some(
        (p) => p._id.toString() === payload.userId,
      );
      if (!isUserInRoom) {
        return { status: STATUS.USER_NOT_IN_ROOM };
      }
      return { status: STATUS.JOIN_SUCCESS, call };
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
      await call.save();
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
}
