import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';
import { Message } from 'src/messages/schemas/messages.schema';

export type SearchMainResult = {
  users: User[];
  rooms: Room[];
  messages: Message[];
};
