import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormService } from './form.service';
import {
  FormResponse,
  FormResponseSchema,
} from './schemas/form-response.schema';
import { Form, FormSchema } from './schemas/form.schema';
import { FormField, FormFieldSchema } from './schemas/form-field.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Form.name,
        schema: FormSchema,
      },
      {
        name: FormResponse.name,
        schema: FormResponseSchema,
      },
      {
        name: FormField.name,
        schema: FormFieldSchema,
      },
    ]),
  ],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
