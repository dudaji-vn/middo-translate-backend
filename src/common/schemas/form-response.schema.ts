import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { FormField } from 'src/common/schemas/form-field.schema';
import { Form } from './form.schema';

@Schema({
  timestamps: false,
  _id: false,
})
export class Answer {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: FormField.name,
    required: true,
  })
  field: FormField;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  value: any;
}
@Schema({
  timestamps: true,
})
export class FormResponse {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Form.name,
    required: true,
  })
  form: Form;

  @Prop({
    type: [{ type: Answer }],
    default: [],
  })
  answers: Answer[];
}

export const FormResponseSchema = SchemaFactory.createForClass(FormResponse);
