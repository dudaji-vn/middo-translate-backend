import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  timestamps: true,
})
export class Notification {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: String, index: true, unique: true })
  userId: string;
  @Prop({
    type: [String],
    default: [],
  })
  tokens: string[];
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
