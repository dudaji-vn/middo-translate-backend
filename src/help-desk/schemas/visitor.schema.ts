import mongoose, { Document } from 'mongoose';
import { Space } from './space.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
})
export class Visitor extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true })
  space: Space;
  @Prop({
    type: String,
  })
  fromDomain: string;

  @Prop({
    type: Number,
    default: 0,
  })
  count: number;
}
export const VisitorSchema = SchemaFactory.createForClass(Visitor);
