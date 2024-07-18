import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormService } from './form.service';
import {
  FormResponse,
  FormResponseSchema,
} from './schemas/form-response.schema';
import { Form, FormSchema } from './schemas/form.schema';

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
