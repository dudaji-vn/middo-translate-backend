import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument, ObjectId } from 'mongoose';
import { Call } from 'src/call/schemas/call.schema';
import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';
import { NodeChatFlowDto } from 'src/help-desk/dto/node-chat-dto';
import { Script } from 'src/help-desk/schemas/space.schema';
import { Form } from 'src/form/schemas/form.schema';

@Schema({ _id: false }) // _id: false because this is a subdocument
export class Reaction extends Document {
  @Prop({ required: true })
  emoji: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  user: User;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

export type MessageDocument = HydratedDocument<Message>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  PENDING = 'pending',
  REMOVED = 'removed',
  EDITED = 'edited',
}

export enum MessageType {
  TEXT = 'text',
  CALL = 'call',
  MEDIA = 'media',
  FORWARD = 'forward',
  NOTIFICATION = 'notification',
  ACTION = 'action',
  FLOW_ACTIONS = 'flow-actions',
  FLOW_FORM = 'flow-form',
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

export type Action = {
  content: string;
  link?: string;
};

export enum ActionTypes {
  NONE = 'none',
  ADD_USER = 'addUser',
  REMOVE_USER = 'removeUser',
  LEAVE_GROUP = 'leaveGroup',
  PIN_MESSAGE = 'pinMessage',
  UNPIN_MESSAGE = 'unpinMessage',
  UPDATE_GROUP_NAME = 'updateGroupName',
  REMOVE_GROUP_NAME = 'removeGroupName',
  UPDATE_GROUP_AVATAR = 'updateGroupAvatar',
  CREATE_GROUP = 'createGroup',
  LEAVE_HELP_DESK = 'leaveHelpDesk',
}

export enum SenderType {
  BOT = 'bot',
  USER = 'user',
  ANONYMOUS = 'anonymous',
}

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

  @Prop({
    type: String,
    index: true,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Prop({ type: String })
  action: ActionTypes;

  @Prop({ type: Array, default: [] })
  media: Media[];

  @Prop({ type: Array, default: [] })
  actions: NodeChatFlowDto[];

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
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  targetUsers: User[];

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  mentions: User[];

  @Prop({ type: String })
  language: string;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  forwardOf: Message;

  @Prop({ type: Boolean, default: false })
  isForwarded: boolean;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Call' })
  call: Call;
  // parent message
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  parent: Message;
  @Prop({ type: Boolean, default: false })
  hasChild: boolean;

  @Prop({ type: Boolean, default: false })
  isComplete: boolean;

  // a filed for translation records wit type json
  @Prop({ type: mongoose.Schema.Types.Mixed })
  translations: any;
  @Prop({ type: String })
  senderType: SenderType;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Script.name })
  script: Script | null;

  @Prop({ type: [String], default: [] })
  editHistory: string[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Form' })
  form: Form;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
