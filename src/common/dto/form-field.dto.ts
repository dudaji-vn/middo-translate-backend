import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { FormType } from 'src/form/schemas/form-field.schema';

export class FormFieldDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsEnum(FormType)
  type: FormType;

  @IsBoolean()
  required: boolean;

  @IsArray()
  @ArrayUnique()
  options?: string[];

  @IsNumber()
  order: number;

  @IsMongoId()
  @IsOptional()
  _id: string;
}
