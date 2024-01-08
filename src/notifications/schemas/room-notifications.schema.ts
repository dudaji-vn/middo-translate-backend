import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';

export type RoomNotificationDocument = HydratedDocument<RoomNotification>;

@Schema({
  timestamps: true,
})
export class RoomNotification {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Room.name })
  room: Room;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  user: User;

  @Prop({ type: Number, default: 0 })
  mutedDuration: number;
}

export const RoomNotificationSchema =
  SchemaFactory.createForClass(RoomNotification);

RoomNotificationSchema.index({ user: 1, room: 1 }, { unique: true });
