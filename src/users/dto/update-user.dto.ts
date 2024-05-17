import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty()
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(15)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username can only contain lowercase letters, numbers, and underscores',
  })
  readonly username?: string;
}
