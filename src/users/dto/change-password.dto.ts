import { IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswpodDto {
  @ApiProperty()
  @IsString()
  readonly currentPassword: string;
  @ApiProperty()
  @IsString()
  readonly newPassword: string;
}
