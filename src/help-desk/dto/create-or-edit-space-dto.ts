import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MemberStatus, ROLE } from '../schemas/help-desk-business.schema';

export class MemberDto {
  @IsEnum(ROLE)
  role: ROLE;
  @IsEmail()
  email: string;

  verifyToken: string;
  status: MemberStatus;
  invitedAt: Date;
}

export class CreateOrEditSpaceDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  backgroundImage: string;

  @ApiProperty()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members: MemberDto[];
}
