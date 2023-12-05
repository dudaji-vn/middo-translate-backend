import { IsOptional, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class SetupInfoDto {
  @ApiProperty()
  @IsOptional()
  avatar?: string;
  @ApiProperty()
  @IsString()
  readonly name: string;
  @ApiProperty()
  @IsString()
  readonly language: string;
}
