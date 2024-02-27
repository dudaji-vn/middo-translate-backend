import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Watching } from './schemas/watching.schema';
import { Model } from 'mongoose';
import { CreateWatchingDto } from './dto/create-watching.dto';

@Injectable()
export class WatchingService {
  constructor(
    @InjectModel(Watching.name) private readonly roomModel: Model<Watching>,
  ) {}
  async create(data: CreateWatchingDto): Promise<Watching> {
    const room = new this.roomModel(data);
    return room.save();
  }
  async deleteBySocketId(socketId: string) {
    return this.roomModel.findOneAndDelete({ socketId });
  }
  async getWatchingListByUserIdsAndNotifyTokens(
    userIds: string[],
    notifyTokens: string[],
  ) {
    return this.roomModel.find({
      // userId: { $in: userIds },
      notifyToken: { $in: notifyTokens },
    });
  }
  async getWatchingListByRoomId(roomId: string) {
    return this.roomModel.find({ roomId });
  }
}
