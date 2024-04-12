import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StatusBusiness } from '../schemas/help-desk-business.schema';

export class ChatFlowDto {
  edges: any;
  nodes: any;
}
export class CreateOrEditBusinessDto {
  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(5)
  domains: string[];

  @ApiProperty()
  @IsString()
  color: string;

  @ApiProperty()
  @IsString()
  language: string;

  @ApiProperty()
  firstMessage: string;

  @ApiProperty()
  firstMessageEnglish: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ChatFlowDto)
  chatFlow: ChatFlowDto | null;

  status: StatusBusiness;
}
