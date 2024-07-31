import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
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

export class Option {
  @Prop({
    type: String,
  })
  type: string;

  @Prop({
    type: String,
  })
  value: string;

  @Prop({
    type: String,
  })
  media: string;
}

@Schema({ timestamps: true })
export class FormField extends Document {
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
  placeholder: string;

  @Prop({ type: String })
  type: FormType;

  @Prop({ type: String })
  dataType: FormDataType;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({ type: Number })
  order: number;

  @Prop({
    type: [{ type: Option }],
    default: [],
  })
  options: Option[];
}

export const FormFieldSchema = SchemaFactory.createForClass(FormField);
