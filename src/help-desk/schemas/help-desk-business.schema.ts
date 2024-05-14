import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, ObjectId } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { ChatFlow, ChatFlowSchema } from './chat-flow.schema';
import { Script, ScriptSchema, Space, SpaceSchema } from './space.schema';

export enum StatusBusiness {
  DELETED = 'deleted',
  ACTIVE = 'active',
}
export enum TreeNodeType {
  BUTTON = 'button',
  MESSAGE = 'message',
  LINK = 'link',
  FORM = 'form',
}

export enum MemberStatus {
  INVITED = 'invited',
  PENDING = 'pending',
  JOINED = 'joined',
  DELETED = 'deleted',
}

export enum ROLE {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Schema({ _id: false, timestamps: true }) // _id: false because this is a subdocument
export class Rating extends Document {
  @Prop({ type: Number, required: true })
  star: number;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

@Schema({
  timestamps: true,
})
export class HelpDeskBusiness {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true,
    unique: true,
  })
  space: Space;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: User | string;

  @Prop({
    type: String,
  })
  name: string;

  @Prop({ type: Array })
  domains: string[];

  @Prop({ type: String })
  color: string;

  @Prop({ type: String, required: true })
  language: string;

  @Prop({ type: String })
  firstMessage: string;

  @Prop({ type: String })
  firstMessageEnglish: string;

  @Prop({ type: String })
  status: StatusBusiness;

  @Prop({ type: [RatingSchema], default: [] })
  ratings: Rating[];

  @Prop({ type: ChatFlowSchema })
  chatFlow: ChatFlow;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Script',
  })
  currentScript: Script;
}

export const HelpDeskBusinessSchema =
  SchemaFactory.createForClass(HelpDeskBusiness);
