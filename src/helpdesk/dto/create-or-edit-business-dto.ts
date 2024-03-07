import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class CreateOrEditBusinessDto {
  @ApiProperty()
  @IsString()
  domain: string;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiProperty()
  @IsString()
  language: string;

  @ApiProperty()
  firstMessage: string;

  @ApiProperty()
  secondMessage: string;
}
