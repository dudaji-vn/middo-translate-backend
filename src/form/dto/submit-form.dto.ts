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
import { IsArrayUnique } from 'src/common/validators';

export class AnswerDto {
  @IsMongoId()
  fieldId: string;

  @IsString()
  @IsOptional()
  value: string;
}

export class SubmitFormDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  @IsArrayUnique('fieldId', {
    message: 'Each form field fieldId must be unique',
  })
  answers: AnswerDto[];
}
