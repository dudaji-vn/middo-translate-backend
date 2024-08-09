import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

import { User } from 'src/users/schemas/user.schema';

export enum BotStatus {
  DELETED = 'deleted',
  ACTIVE = 'active',
}

@Schema({
  timestamps: true,
})
export class Bot {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  name: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  endpoint: string;

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({ type: String, default: BotStatus.ACTIVE })
  status: BotStatus;
}

export const BotSchema = SchemaFactory.createForClass(Bot);
