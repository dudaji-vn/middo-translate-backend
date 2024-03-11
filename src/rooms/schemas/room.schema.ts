import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Message } from 'src/messages/schemas/messages.schema';
import { User } from 'src/users/schemas/user.schema';

export type RoomDocument = HydratedDocument<Room>;
export enum RoomStatus {
  ACTIVE = 'active',
  TEMPORARY = 'temporary',
  DELETED = 'deleted',
  CANNOT_MESSAGE = 'cannot_message',
}

@Schema({
  timestamps: true,
})
export class Room {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
    default: [],
  })
  participants: User[];

  @Prop({ type: String })
  avatar: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: Boolean, default: false })
  isGroup: boolean;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  admin: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
  lastMessage?: Message;

  @Prop({ type: String, default: RoomStatus.ACTIVE })
  status: RoomStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  deletedBy: User;

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop({ type: Date, default: Date.now, index: true })
  newMessageAt: Date;

  @Prop({ type: Boolean, default: false })
  isSetName: boolean;

  @Prop({ type: Boolean, default: false })
  isHelpDesk: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
