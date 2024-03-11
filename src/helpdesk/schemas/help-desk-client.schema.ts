import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { HelpDeskBusiness } from './help-desk-business.schema';

@Schema({
  timestamps: true,
})
export class HelpDeskClient {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: HelpDeskBusiness.name,
    required: true,
  })
  business: HelpDeskBusiness;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: User;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  phoneNumber: string;

  @Prop({ type: String, required: true })
  language: string;

  @Prop({ type: String, default: '' })
  avatar: string;
}

export const HelpDeskClientSchema =
  SchemaFactory.createForClass(HelpDeskClient);
