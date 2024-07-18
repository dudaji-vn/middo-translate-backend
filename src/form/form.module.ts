import { Module } from '@nestjs/common';
import { FormService } from './form.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Form, FormSchema } from '../common/schemas/form.schema';
import { FormField } from '../common/schemas/form-field.schema';
import {
  FormResponse,
  FormResponseSchema,
} from '../common/schemas/form-response.schema';

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
    ]),
  ],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
