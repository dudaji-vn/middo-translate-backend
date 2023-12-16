import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, ObjectId } from 'mongoose';

import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  PENDING = 'pending',
  REMOVED = 'removed',
}

export enum MessageType {
  TEXT = 'text',
  CALL = 'call',
  MEDIA = 'media',
  NOTIFICATION = 'notification',
}

export enum MediaTypes {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export type Media = {
  type: MediaTypes;
  url: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
};

@Schema({
  timestamps: true,
})
export class Message {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  sender: User;

  @Prop({ type: String })
  content: string;

  @Prop({ type: String })
  contentEnglish: string;

  @Prop({ type: String, index: true, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ type: Array, default: [] })
  media: Media[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true })
  room: Room;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  deliveredTo: ObjectId[] | string[];
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  readBy: ObjectId[] | string[];
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  removedFor: ObjectId[] | string[];
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  deleteFor: ObjectId[] | string[];

  @Prop({ type: String, default: MessageStatus.SENT })
  status: MessageStatus;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
