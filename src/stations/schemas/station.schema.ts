import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Member, MemberSchema } from './member.schema';

export enum StationStatus {
  DELETED = 'deleted',
  ACTIVE = 'active',
}

@Schema({
  timestamps: true,
})
export class Station {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  owner: User;

  @Prop({
    type: String,
  })
  name: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
  })
  backgroundImage: string;

  @Prop({
    type: [MemberSchema],
    default: [],
  })
  members: Member[];

  @Prop({ type: String, default: StationStatus.ACTIVE })
  status: StationStatus;
}

export const StationSchema = SchemaFactory.createForClass(Station);
