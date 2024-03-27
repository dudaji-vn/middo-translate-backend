import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema()
export class PhraseItem extends Document {
  @Prop({ required: true })
  name: string;
}

export const PhraseItemSchema = SchemaFactory.createForClass(PhraseItem);

@Schema({
  timestamps: true,
})
export class Phrase {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: String, required: true })
  topic: string;
  @Prop({ type: [PhraseItemSchema], default: [] })
  items: PhraseItem;
}

export const PhraseSchema = SchemaFactory.createForClass(Phrase);
