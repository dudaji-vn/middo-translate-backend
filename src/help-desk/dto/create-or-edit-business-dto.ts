import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';
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
}
