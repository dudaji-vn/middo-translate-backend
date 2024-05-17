import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
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
  invitedAt?: Date;
  joinedAt?: Date;
  expiredAt?: Date;
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

  @ApiProperty()
  spaceId: string;
}

export class InviteMemberDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members: MemberDto[];
}

export class RemoveMemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class CreateOrEditTagDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  tagId: string;
}

export class UpdateMemberDto {
  @IsEnum(ROLE)
  role: ROLE;
  @IsEmail()
  email: string;
}
