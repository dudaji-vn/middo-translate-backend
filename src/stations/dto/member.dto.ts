import { IsEmail } from 'class-validator';
import { MemberStatus } from '../schemas/member.schema';
import { ApiProperty } from '@nestjs/swagger';

export class MemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
