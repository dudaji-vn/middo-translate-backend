import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Station } from 'src/stations/schemas/station.schema';
import { User } from 'src/users/schemas/user.schema';

@Schema({
  timestamps: true,
})
export class AppNotification {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Station.name,
  })
  station: Station;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  from: User;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  to: User;

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

export const AppNotificationSchema =
  SchemaFactory.createForClass(AppNotification);
