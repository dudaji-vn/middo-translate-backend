import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Team } from 'src/stations/schemas/team.schema';
import { Station } from 'src/stations/schemas/station.schema';
import { Bot } from './bot.schema';

export enum ScopeType {
  ALL = 'all',
  ADMIN = 'admin',
  SPECIFIC = 'specific',
}

@Schema({
  timestamps: true,
})
export class ScopeBot {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Station' })
  station: Station;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Bot' })
  bot: Bot;

  @Prop({ type: String, default: ScopeType.ADMIN })
  type: ScopeType;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    default: [],
  })
  teams: Team[];
}

export const ScopeBotSchema = SchemaFactory.createForClass(ScopeBot);
