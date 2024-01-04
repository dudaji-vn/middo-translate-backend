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
  endTime: Date;
  @Prop({ type: String, unique: true })
  slug: string;
  @Prop({ type: String })
  name: string;
}

export const CallSchema = SchemaFactory.createForClass(Call);
