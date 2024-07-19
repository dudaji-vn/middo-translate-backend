import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FormFieldDto } from 'src/common/dto/form-field.dto';
import { IsArrayUnique } from 'src/common/validators';
import { LayoutForm } from '../schemas/customize.schema';
export class ThankyouDto {
  @IsOptional()
  @IsString()
  image: string;

  @IsOptional()
  @IsString()
  subTitle: string;

  @IsOptional()
  @IsString()
  title: string;
}

export class CustomizeDto {
  @IsOptional()
  @IsString()
  theme: string;

  @IsOptional()
  @IsString()
  background: string;

  @IsOptional()
  @IsEnum(LayoutForm)
  layout: string;
}

export class CreateOrEditFormDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  formId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  @IsArrayUnique('name', { message: 'Each form field name must be unique' })
  @IsArrayUnique('order', { message: 'Each form field order must be unique' })
  formFields: FormFieldDto[];

  @ValidateNested()
  @Type(() => ThankyouDto)
  thankyou: ThankyouDto;

  @ValidateNested()
  @Type(() => CustomizeDto)
  customize: CustomizeDto;
}
