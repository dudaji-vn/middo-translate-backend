import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

@Schema({
  timestamps: true,
})
export class HelpDesk {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  manager: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  middoClient: User;
}

export const HelpDeskSchema = SchemaFactory.createForClass(HelpDesk);
