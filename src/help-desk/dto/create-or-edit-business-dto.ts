import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Media } from 'src/messages/schemas/messages.schema';
import {
  StatusBusiness,
  TreeNodeType,
} from '../schemas/help-desk-business.schema';
import { Type } from 'class-transformer';

export class ScriptChatDto {
  parentId: string | null;
  id: string | null;

  @IsString()
  content: string;

  @IsEnum(TreeNodeType)
  type: TreeNodeType;

  media: Media[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScriptChatDto)
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
  @ValidateNested()
  @Type(() => ScriptChatDto)
  scriptChat: ScriptChatDto;

  status: StatusBusiness;
}
