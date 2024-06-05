import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, ValidateNested } from 'class-validator';
import { MemberStatus, ROLE } from '../schemas/member.schema';

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
export class CreateOrEditStationDto {
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
