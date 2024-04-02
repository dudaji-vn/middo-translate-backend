import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';
import { Media } from 'src/messages/schemas/messages.schema';
import {
  StatusBusiness,
  TreeNodeType,
} from '../schemas/help-desk-business.schema';

export class ScriptChatDto {
  @IsString()
  content: string;

  @IsString()
  language: string;

  @IsEnum(TreeNodeType)
  type: TreeNodeType;

  @IsArray()
  media: Media[];

  @IsArray()
  childrens: ScriptChatDto[];
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
  @IsString()
  @MinLength(1)
  firstMessage: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstMessageEnglish: string;

  @ApiProperty()
  scriptChat: ScriptChatDto;

  status: StatusBusiness;
}
