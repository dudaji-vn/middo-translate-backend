import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Room } from 'src/rooms/schemas/room.schema';

export type CallDocument = HydratedDocument<Call>;

@Schema({
  timestamps: true,
})
export class Call {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  })
  roomId: Room;
  @Prop({ type: Date, default: null })
  startTime: Date;
  @Prop({ type: Date, default: null })
  endTime: Date;
  @Prop({ type: String })
  avatar: string;
  @Prop({ type: String })
  type: string;
  @Prop({ type: String })
  name: string;
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: string;
}

export const CallSchema = SchemaFactory.createForClass(Call);
