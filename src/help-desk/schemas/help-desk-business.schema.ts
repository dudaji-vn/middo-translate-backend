import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Media } from 'src/messages/schemas/messages.schema';

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

@Schema({ _id: false, timestamps: true }) // _id: false because this is a subdocument
export class Rating extends Document {
  @Prop({ type: Number, required: true })
  star: number;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User;
}

@Schema({ _id: false })
export class ScriptChat extends Document {
  @Prop({ type: String, required: true })
  id: string;
  @Prop({ type: String, required: true })
  content: string;
  @Prop({ type: String, required: true })
  language: string;
  @Prop({ type: String, default: 'message' })
  type: TreeNodeType;
  @Prop({ type: Array, default: [] })
  media: Media[];

  @Prop({
    type: [{ type: mongoose.Types.ObjectId, ref: 'ScriptChat' }],
    default: [],
    ref: 'ScriptChat',
  })
  childrens: ScriptChat[];

  @Prop({
    type: String,
  })
  parentId: string;
}
export const ScriptChatSchema = SchemaFactory.createForClass(ScriptChat);

export const RatingSchema = SchemaFactory.createForClass(Rating);

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

  @Prop({ type: ScriptChatSchema })
  scriptChat: ScriptChat;
}

export const HelpDeskBusinessSchema =
  SchemaFactory.createForClass(HelpDeskBusiness);
