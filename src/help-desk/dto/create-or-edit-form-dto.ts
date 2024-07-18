import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FormFieldDto } from 'src/common/dto/form-field.dto';
import { FormField } from 'src/form/schemas/form-field.schema';
import { IsArrayUnique } from 'src/common/validators';

export class CreateOrEditFormDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  formId: string;

  @IsString()
  color: string;

  @IsString()
  backgroundColor: string;

  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  @IsArrayUnique('name', { message: 'Each form field name must be unique' })
  @IsArrayUnique('order', { message: 'Each form field order must be unique' })
  formFields: FormField[];
}
