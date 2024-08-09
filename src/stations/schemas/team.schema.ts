import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Station } from './station.schema';

export const DEFAULT_ADMIN_NAME = 'administrator';

export enum TeamRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Schema({
  timestamps: true,
})
export class Team {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true,
  })
  station: Station;

  @Prop({
    type: String,
    default: TeamRole.MEMBER,
  })
  role: TeamRole;

  @Prop({
    type: Boolean,
    default: true,
  })
  isDeletable: boolean;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.index({ name: 1, station: 1 }, { unique: true });
