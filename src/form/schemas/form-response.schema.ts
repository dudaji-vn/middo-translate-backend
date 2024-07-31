import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { FormField } from 'src/form/schemas/form-field.schema';
import { Space } from 'src/help-desk/schemas/space.schema';
import { User } from 'src/users/schemas/user.schema';
import { Form } from './form.schema';

@Schema({
  timestamps: false,
  _id: false,
})
export class Answer {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FormField',
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: User;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
  })
  space: Space;

  @Prop({
    type: [{ type: Answer }],
    default: [],
  })
  answers: Answer[];
}

export const FormResponseSchema = SchemaFactory.createForClass(FormResponse);
