import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RemoveMemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
