import mongoose, { Document } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Station } from 'src/stations/schemas/station.schema';
import { Space } from 'src/help-desk/schemas/space.schema';
import { User } from 'src/users/schemas/user.schema';

@Schema({ _id: false, timestamps: { createdAt: false, updatedAt: true } })
export class Keyword {
  @Prop({
    type: String,
    required: true,
  })
  keyword: string;
}
const KeywordSchema = SchemaFactory.createForClass(Keyword);

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
})
export class Search extends Document {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: User;

  @Prop({
    type: [KeywordSchema],
    default: [],
  })
  keywords: Keyword[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Station.name })
  station: Station;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Space.name })
  space: Space;
}
export const SearchSchema = SchemaFactory.createForClass(Search);
