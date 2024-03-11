import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
export class CreateOrEditBusinessDto {
  @ApiProperty()
  @IsArray()
  domain: string[];

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
}
