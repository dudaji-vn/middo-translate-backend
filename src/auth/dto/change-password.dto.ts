import { IsString, Matches, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { envConfig } from 'src/configs/env.config';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  password: string;
  @IsString()
  @MinLength(8)
  @Matches(envConfig.password.RegExp, {
    message: envConfig.password.errorMessage,
  })
  newPassword: string;
}
