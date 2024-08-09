import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Member, MemberSchema } from './member.schema';
import { Team } from './team.schema';

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
    ref: 'User',
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

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    default: [],
  })
  teams: Team[];

  @Prop({ type: String, default: StationStatus.ACTIVE })
  status: StationStatus;
}

export const StationSchema = SchemaFactory.createForClass(Station);
