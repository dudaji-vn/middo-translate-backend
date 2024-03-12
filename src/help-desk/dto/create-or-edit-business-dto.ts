import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, MinLength } from 'class-validator';
export class CreateOrEditBusinessDto {
  @ApiProperty()
  @IsArray()
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
}
