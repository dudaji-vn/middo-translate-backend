import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RoomsService } from 'src/rooms/rooms.service';
import { Call } from './schemas/call.schema';
import { Model } from 'mongoose';
import { generateSlug } from 'src/common/utils/generate-slug';
import { STATUS } from './constants/call-status';
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
          slug: call.slug,
        };
      }
      let slug = '';
      do {
        slug = generateSlug();
        const call = await this.callModel.exists({ slug });
        if (!call) break;
      } while (true);
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
      const newCall = { roomId: payload.roomId, slug, name: roomName };

      const newCallObj = await this.callModel.create(newCall);
      return {
        status: true,
        slug: newCallObj.slug,
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
}
