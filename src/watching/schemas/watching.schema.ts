import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type WatchingDocument = HydratedDocument<Watching>;

@Schema({
  timestamps: true,
})
export class Watching {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: String })
  userId: string;
  @Prop({ type: String })
  roomId: string;
  @Prop({ type: String })
  notifyToken: string;
  @Prop({ type: String })
  socketId: string;
}

export const WatchingSchema = SchemaFactory.createForClass(Watching);

WatchingSchema.index(
  {
    userId: 1,
    roomId: 1,
    notifyToken: 1,
    socketId: 1,
  },
  { unique: true },
);
