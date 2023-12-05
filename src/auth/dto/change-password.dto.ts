import { IsString, Matches, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  password: string;
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'password too weak, must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  newPassword: string;
}
