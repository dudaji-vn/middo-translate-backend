import { Type } from 'class-transformer';
import {
  IsDefined,
  IsMongoId,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class AnswerDto {
  [key: string]: string;
}

export class SubmitFormDto {
  @IsDefined()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answer: AnswerDto;

  @IsOptional()
  @IsMongoId()
  messageId: string;
}
