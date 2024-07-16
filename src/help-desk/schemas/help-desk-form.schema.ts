import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { FormField } from 'src/common/schemas/form-field.schema';
import { User } from 'src/users/schemas/user.schema';
import { Space } from './space.schema';

@Schema({ timestamps: true })
export class HelpDeskForm extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true })
  space: Space;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  })
  createdBy: User | string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  })
  lastEditedBy: User | string;

  @Prop({ type: Boolean, default: false })
  isUsing: boolean;

  @Prop({ type: String })
  color: string;

  @Prop({ type: String })
  backgroundColor: string;

  @Prop({
    type: [{ type: FormField }],
    default: [],
  })
  formFields: FormField[];

  @Prop({
    type: [{ type: String }],
  })
  images: string[];

  @Prop({
    type: Boolean,
  })
  isDeleted: boolean;
}

export const HelpDeskFormSchema = SchemaFactory.createForClass(HelpDeskForm);
