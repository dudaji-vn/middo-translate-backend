import { IsOptional, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty()
  @IsOptional()
  readonly avatar?: string;
  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly name?: string;
  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly language?: string;
}
