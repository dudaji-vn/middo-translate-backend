import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { ObjectId } from 'mongoose';
import { Station } from 'src/stations/schemas/station.schema';

@Schema({
  timestamps: true,
})
export class InvitationStation {
  @Prop({ type: String })
  link: string;

  @Prop({ type: String })
  token: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Station.name,
    unique: true,
  })
  station: ObjectId;
}

export const InvitationStationSchema =
  SchemaFactory.createForClass(InvitationStation);

InvitationStationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 24 * 60 * 60,
  },
);
