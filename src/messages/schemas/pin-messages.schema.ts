import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { User } from 'src/users/schemas/user.schema';
import { Message } from './messages.schema';
import { Room } from 'src/rooms/schemas/room.schema';

export type PinMessageDocument = HydratedDocument<PinMessage>;

@Schema({
  timestamps: true,
})
export class PinMessage {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  message: Message;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  pinnedBy: User;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Room.name })
  room: Room;
}

export const PinMessageSchema = SchemaFactory.createForClass(PinMessage);

PinMessageSchema.index({ pinnedBy: 1, message: 1 }, { unique: true });
PinMessageSchema.index({ room: 1 });
