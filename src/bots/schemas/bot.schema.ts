import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Team } from 'src/stations/schemas/team.schema';
import { Station } from 'src/stations/schemas/station.schema';
import { User } from 'src/users/schemas/user.schema';

export enum ScopeType {
  ALL = 'all',
  ADMIN = 'admin',
  SPECIFIC = 'specific',
}

export class Scope {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Station' })
  station: Station;

  @Prop({ type: ScopeType, default: ScopeType.ADMIN })
  type: ScopeType;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    default: [],
  })
  teams: Team[];
}

@Schema({
  timestamps: true,
})
export class Bot {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  name: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  endpoint: string;

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    type: [{ type: Scope }],
    default: [],
  })
  scopes: Scope[];
}

export const BotSchema = SchemaFactory.createForClass(Bot);
