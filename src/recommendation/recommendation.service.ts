import { Injectable } from '@nestjs/common';
import { RoomsService } from 'src/rooms/rooms.service';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly userService: UsersService,
    private readonly roomSerVice: RoomsService,
  ) {}
  async getRecommendUsersBasedRecentlyChat(userId: string): Promise<User[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const rooms = await this.roomSerVice.findRecentChatRooms(userId);

    const users = rooms.map((room) => {
      const participants = room.participants.filter(
        (participant) => participant._id.toString() !== userId,
      );
      return participants[0];
    });

    return users;
  }
}
