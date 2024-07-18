import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Form } from './form.schema';

export enum FormType {
  TEXT = 'text',
  NUMBER = 'message',
  DATE = 'date',
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
}

@Schema({ timestamps: true })
export class FormField {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Form.name,
    required: true,
  })
  form: Form;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  label: string;

  @Prop({ type: String })
  type: FormType;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({
    type: [{ type: String }],
    default: [],
  })
  options?: string[];

  @Prop({ type: Number })
  order: number;
}

export const FormFieldSchema = SchemaFactory.createForClass(FormField);
