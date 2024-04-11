import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { ChatFlow, ChatFlowSchema } from './chat-flow.schema';

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
  JOINED = 'joined',
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

@Schema({ _id: false })
export class Member {
  @Prop({ type: String, default: MemberStatus.INVITED })
  status: MemberStatus;

  @Prop({ type: String, default: ROLE.MEMBER })
  role: ROLE;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: String })
  email: string;

  @Prop({ type: Date })
  joinedAt: Date;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

export const MemberSchema = SchemaFactory.createForClass(Member);

@Schema({
  timestamps: true,
})
export class HelpDeskBusiness {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user: User | string;

  @Prop({
    type: String,
  })
  name: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
  })
  backgroundImage: string;

  @Prop({
    type: [MemberSchema],
    default: [],
  })
  members: Member;

  @Prop({ type: Array })
  domains: string[];

  @Prop({ type: String })
  color: string;

  @Prop({ type: String, required: true })
  language: string;

  @Prop({ type: String, required: true })
  firstMessage: string;

  @Prop({ type: String, required: true })
  firstMessageEnglish: string;

  @Prop({ type: String })
  status: StatusBusiness;

  @Prop({ type: [RatingSchema], default: [] })
  ratings: Rating[];

  @Prop({ type: ChatFlowSchema })
  chatFlow: ChatFlow;
}

export const HelpDeskBusinessSchema =
  SchemaFactory.createForClass(HelpDeskBusiness);
