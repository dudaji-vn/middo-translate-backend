import { IsEmail } from 'class-validator';
import { MemberStatus } from '../schemas/member.schema';

export class MemberDto {
  @IsEmail()
  email: string;
  verifyToken: string;
  status: MemberStatus;
  invitedAt?: Date;
  joinedAt?: Date;
  expiredAt?: Date;
  verifyUrl: string;
}
