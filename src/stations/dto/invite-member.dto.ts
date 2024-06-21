import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsString, ValidateNested } from 'class-validator';
import { MemberDto } from './member.dto';

export class InviteMemberDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members: MemberDto[];
}

export class InviteMemberWithLink {
  @IsString()
  verifyUrl: string;

  @IsEmail()
  email: string;
}
