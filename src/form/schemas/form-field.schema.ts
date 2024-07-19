import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Form } from './form.schema';

export enum FormType {
  INPUT = 'input',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  DATE = 'date',
  SELECT = 'select',
}

export enum FormDataType {
  TEXT = 'text',
  LONG_TEXT = 'long-text',
  DATE = 'date',
  TIME = 'time',
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

  @Prop({ type: String })
  dataType: FormDataType;

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
