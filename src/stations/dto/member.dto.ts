import { IsEmail, IsMongoId } from 'class-validator';
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
