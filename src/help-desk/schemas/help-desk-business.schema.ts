import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

export enum StatusBusiness {
  DELETED = 'deleted',
  ACTIVE = 'active',
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
}

export const HelpDeskBusinessSchema =
  SchemaFactory.createForClass(HelpDeskBusiness);
