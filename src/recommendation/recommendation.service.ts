import { Injectable } from '@nestjs/common';
import { RoomsService } from 'src/rooms/rooms.service';
import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { RecommendQueryDto } from './dto/recommend-query-dto';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly userService: UsersService,
    private readonly roomSerVice: RoomsService,
  ) {}
  async getRecommendUsersBasedRecentlyChat(
    userId: string,
    query: RecommendQueryDto,
  ): Promise<User[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const rooms = await this.roomSerVice.findRecentChatRooms(
      userId,
      true,
      query,
    );
    const users: User[] = [];
    rooms.map((room) => {
      const participants = room.participants.filter(
        (participant) => participant._id.toString() !== userId,
      );
      if (participants.length > 0) {
        users.push(participants[0]);
      }
    });

    return users;
  }

  async getRecommendBasedRecentlyChat(
    userId: string,
    query?: RecommendQueryDto,
  ): Promise<Room[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return await this.roomSerVice.findRecentChatRooms(userId, false, query);
  }
}
