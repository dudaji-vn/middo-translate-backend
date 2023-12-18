import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  readonly currentPassword: string;
  @ApiProperty()
  @IsString()
  readonly newPassword: string;
}
