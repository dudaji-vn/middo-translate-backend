import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { envConfig } from 'src/configs/env.config';

export class SignUpDto {
  @ApiProperty()
  @IsEmail()
  email: string;
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(envConfig.password.RegExp, {
    message: envConfig.password.errorMessage,
  })
  password: string;
}
