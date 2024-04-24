import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Space } from './space.schema';

@Schema({
  timestamps: true,
})
export class SpaceNotification {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true,
  })
  space: Space;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  from: User;

  @Prop({
    type: String,
  })
  to: string;

  @Prop({
    type: String,
  })
  description: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  unRead?: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isDeleted?: boolean;

  @Prop({
    type: String,
  })
  link: string;
}

export const SpaceNotificationSchema =
  SchemaFactory.createForClass(SpaceNotification);
