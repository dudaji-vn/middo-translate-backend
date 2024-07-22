import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StatusBusiness } from '../schemas/help-desk-business.schema';
import { NodeChatFlowDto } from './node-chat-dto';

export class ChatFlowDto {
  edges: any;
  nodes: NodeChatFlowDto[];
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

  status: StatusBusiness;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  currentScript: string | null;

  space: string;
  user: any;
}
