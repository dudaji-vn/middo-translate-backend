import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

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

  @Prop({ type: String })
  domain: string;

  @Prop({ type: String })
  color: string;

  @Prop({ type: String, required: true })
  language: string;

  @Prop({ type: String, required: true })
  firstMessage: string;

  @Prop({ type: String, required: true })
  secondMessage: string;
}

export const HelpDeskBusinessSchema =
  SchemaFactory.createForClass(HelpDeskBusiness);
