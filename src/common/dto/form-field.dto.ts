import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FormDataType, FormType } from 'src/form/schemas/form-field.schema';

export class OptionDto {
  @IsString()
  value: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  media: string;
}

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
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @IsMongoId()
  @IsOptional()
  _id: string;
}
