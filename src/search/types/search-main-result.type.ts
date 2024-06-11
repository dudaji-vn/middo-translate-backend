import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';

export type SearchMainResult = {
  users: User[];
  rooms: Room[];
  messages: any;
};
