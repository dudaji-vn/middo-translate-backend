import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { FormDataType, FormType } from 'src/form/schemas/form-field.schema';

export class FormFieldDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsEnum(FormType)
  type: FormType;

  @IsEnum(FormDataType)
  dataType: FormDataType;

  @IsBoolean()
  required: boolean;

  @IsArray()
  @ArrayUnique()
  options?: string[];

  @IsMongoId()
  @IsOptional()
  _id: string;
}
