import { IsEmail, IsMongoId, IsOptional } from 'class-validator';
import { MemberStatus } from '../schemas/member.schema';
import { ApiProperty } from '@nestjs/swagger';

export class MemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class MemberWithUserDto {
  @ApiProperty()
  @IsMongoId()
  userId: string;
}
