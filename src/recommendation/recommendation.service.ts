import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from 'src/messages/schemas/messages.schema';
import { Room, RoomDocument, RoomStatus } from 'src/rooms/schemas/room.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';

@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}
  async getRecommendUsersBasedRecentlyChat(userId: string): Promise<User[]> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const rooms = await this.roomModel
      .find({
        participants: user._id,
        isGroup: false,
        status: RoomStatus.ACTIVE,
      })
      .sort({ newMessageAt: -1 })
      .limit(5)
      .populate('participants');

    const users = rooms.map((room) => {
      const participants = room.participants.filter(
        (participant) => participant._id.toString() !== userId,
      );
      return participants[0];
    });
    console.log(users);
    return users;
  }
}
