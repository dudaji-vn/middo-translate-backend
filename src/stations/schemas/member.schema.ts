import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Team } from './team.schema';

export enum MemberStatus {
  INVITED = 'invited',
  JOINED = 'joined',
  DELETED = 'deleted',
  REJECTED = 'rejected',
}

export enum ROLE {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Schema({ _id: false })
export class Member {
  @Prop({ type: String, default: MemberStatus.INVITED })
  status: MemberStatus;

  @Prop({ type: String, default: ROLE.MEMBER })
  role: ROLE;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user?: User | string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Team' })
  team?: Team;

  @Prop({ type: String })
  email: string;

  @Prop({ type: String })
  verifyToken?: string;

  @Prop({ type: Date })
  invitedAt?: Date;

  @Prop({ type: Date })
  joinedAt?: Date;

  @Prop({ type: Date })
  expiredAt?: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);
