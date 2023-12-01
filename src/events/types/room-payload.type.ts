import { ObjectId } from 'mongoose';
import { Room } from 'src/rooms/schemas/room.schema';

export type UpdateRoomPayload = {
  roomId: string;
  participants: string[] | ObjectId[];
  data: Partial<Room>;
};
