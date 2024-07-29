import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { FormField } from 'src/form/schemas/form-field.schema';
import { Space } from 'src/help-desk/schemas/space.schema';
import { User } from 'src/users/schemas/user.schema';
import { ThankyouSchema } from './thank-you.schema';
import { CustomizeSchema } from './customize.schema';

@Schema({ timestamps: true })
export class Form extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true })
  space: Space | string;

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

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FormField' }],
    default: [],
  })
  formFields: FormField[];

  @Prop({
    type: ThankyouSchema,
  })
  thankyou: ThankyouSchema;

  @Prop({
    type: CustomizeSchema,
  })
  customize: CustomizeSchema;

  @Prop({
    type: Boolean,
  })
  isDeleted: boolean;

  isSubmitted?: boolean;
}

export const FormSchema = SchemaFactory.createForClass(Form);
